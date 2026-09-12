import asyncio
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from redis.asyncio import Redis
from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from .config import get_settings
from .database import SessionLocal, get_session
from .models import Inbox, WebhookEvent
from .schemas import EventOut, InboxCreate, InboxCreated, InboxOut
from .security import hash_token, ip_hint, mask_headers, new_token

settings = get_settings()
redis = Redis.from_url(settings.redis_url, decode_responses=True)


@asynccontextmanager
async def lifespan(_: FastAPI):
    cleanup_task = asyncio.create_task(cleanup_expired_events())
    try:
        yield
    finally:
        cleanup_task.cancel()
        await redis.aclose()


async def cleanup_expired_events() -> None:
    while True:
        cutoff = datetime.now(UTC) - timedelta(hours=settings.event_retention_hours)
        try:
            async with SessionLocal() as session:
                await session.execute(delete(WebhookEvent).where(WebhookEvent.received_at < cutoff))
                await session.commit()
        except Exception:
            # A falha será tentada novamente; nunca inclui conteúdo de eventos nos logs.
            pass
        await asyncio.sleep(3600)


app = FastAPI(
    title="WebhookLab API",
    version="0.1.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.public_base_url],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response


async def find_inbox(token: str, session: AsyncSession) -> Inbox:
    token_digest = hash_token(token, settings.token_secret)
    inbox = await session.scalar(select(Inbox).where(Inbox.token_hash == token_digest))
    if inbox is None:
        raise HTTPException(status_code=404, detail="Endpoint não encontrado")
    return inbox


async def check_rate_limit(request: Request) -> None:
    client = request.client.host if request.client else "unknown"
    bucket = datetime.now(UTC).strftime("%Y%m%d%H%M")
    key = f"rate:{client}:{bucket}"
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, 70)
    if count > settings.rate_limit_per_minute:
        raise HTTPException(status_code=429, detail="Limite de requisições excedido")


async def read_limited_body(request: Request) -> bytes:
    chunks: list[bytes] = []
    size = 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > settings.max_body_bytes:
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Payload muito grande")
        chunks.append(chunk)
    return b"".join(chunks)


@app.get("/api/health")
async def health(session: AsyncSession = Depends(get_session)):
    await session.execute(text("SELECT 1"))
    await redis.ping()
    return {"status": "ok", "version": "0.1.0"}


@app.post("/api/inboxes", response_model=InboxCreated, status_code=201)
async def create_inbox(payload: InboxCreate, session: AsyncSession = Depends(get_session)):
    token = new_token()
    inbox = Inbox(name=payload.name.strip(), token_hash=hash_token(token, settings.token_secret))
    session.add(inbox)
    await session.commit()
    base = settings.public_base_url.rstrip("/")
    return InboxCreated(
        token=token,
        name=inbox.name,
        hook_url=f"{base}/hook/{token}",
        dashboard_url=f"{base}/inbox/{token}",
        expires_events_after_hours=settings.event_retention_hours,
    )


@app.get("/api/inboxes/{token}", response_model=InboxOut)
async def get_inbox(token: str, session: AsyncSession = Depends(get_session)):
    inbox = await find_inbox(token, session)
    cutoff = datetime.now(UTC) - timedelta(hours=settings.event_retention_hours)
    events = list(
        (await session.scalars(
            select(WebhookEvent)
            .where(WebhookEvent.inbox_id == inbox.id, WebhookEvent.received_at >= cutoff)
            .order_by(WebhookEvent.received_at.desc())
            .limit(100)
        )).all()
    )
    return InboxOut(
        name=inbox.name,
        hook_url=f"{settings.public_base_url.rstrip('/')}/hook/{token}",
        retention_hours=settings.event_retention_hours,
        events=[EventOut.model_validate(event) for event in events],
    )


@app.delete("/api/inboxes/{token}/events", status_code=204)
async def clear_events(token: str, session: AsyncSession = Depends(get_session)):
    inbox = await find_inbox(token, session)
    await session.execute(delete(WebhookEvent).where(WebhookEvent.inbox_id == inbox.id))
    await session.commit()
    return Response(status_code=204)


@app.delete("/api/inboxes/{token}/events/{event_id}", status_code=204)
async def delete_event(token: str, event_id: UUID, session: AsyncSession = Depends(get_session)):
    inbox = await find_inbox(token, session)
    result = await session.execute(
        delete(WebhookEvent).where(WebhookEvent.id == event_id, WebhookEvent.inbox_id == inbox.id)
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    await session.commit()
    return Response(status_code=204)


@app.get("/api/inboxes/{token}/stream")
async def stream_events(token: str, session: AsyncSession = Depends(get_session)):
    inbox = await find_inbox(token, session)
    channel = f"inbox:{inbox.id}"
    await session.close()

    async def event_stream():
        pubsub = redis.pubsub()
        await pubsub.subscribe(channel)
        try:
            yield ": connected\n\n"
            while True:
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=15)
                if message:
                    yield f"event: webhook\ndata: {message['data']}\n\n"
                else:
                    yield ": keepalive\n\n"
                await asyncio.sleep(0.05)
        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.aclose()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.api_route("/hook/{token}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
@app.api_route("/hook/{token}/{rest_of_path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def receive_hook(
    token: str,
    request: Request,
    rest_of_path: str = "",
    session: AsyncSession = Depends(get_session),
):
    await check_rate_limit(request)
    inbox = await find_inbox(token, session)
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > settings.max_body_bytes:
                raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Payload muito grande")
        except ValueError:
            raise HTTPException(status_code=400, detail="Content-Length inválido") from None
    raw_body = await read_limited_body(request)
    event = WebhookEvent(
        inbox_id=inbox.id,
        method=request.method,
        path="/" + rest_of_path if rest_of_path else "/",
        query=dict(request.query_params),
        headers=mask_headers(dict(request.headers)),
        body=raw_body.decode("utf-8", errors="replace"),
        content_type=request.headers.get("content-type"),
        body_size=len(raw_body),
        source_ip_hint=ip_hint(request.client.host if request.client else None),
    )
    session.add(event)
    await session.commit()
    await session.refresh(event)
    payload = EventOut.model_validate(event).model_dump_json()
    await redis.publish(f"inbox:{inbox.id}", payload)
    return {"received": True, "event_id": str(event.id)}
