import os

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite://")
os.environ.setdefault("TOKEN_SECRET", "test-secret-with-more-than-32-characters")

import pytest
import pytest_asyncio
from app.database import get_session
from app.main import app, settings
from app.models import Base, Inbox, WebhookEvent
from app.security import hash_token
from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine


@pytest_asyncio.fixture
async def database():
    engine = create_async_engine("sqlite+aiosqlite://")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async def override_session():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    try:
        yield session_factory
    finally:
        app.dependency_overrides.clear()
        await engine.dispose()


@pytest_asyncio.fixture
async def client(database):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as test_client:
        yield test_client


async def create_inbox_with_event(session_factory, token: str = "known-token") -> Inbox:
    async with session_factory() as session:
        inbox = Inbox(name="Nome antigo", token_hash=hash_token(token, settings.token_secret))
        session.add(inbox)
        await session.flush()
        session.add(WebhookEvent(inbox_id=inbox.id, method="POST", path="/", body="{}"))
        await session.commit()
        return inbox


@pytest.mark.asyncio
async def test_patch_inbox_renames_endpoint(client, database):
    await create_inbox_with_event(database)

    response = await client.patch("/api/inboxes/known-token", json={"name": "  Produção  "})

    assert response.status_code == 200
    assert response.json() == {"name": "Produção"}
    get_response = await client.get("/api/inboxes/known-token")
    assert get_response.json()["name"] == "Produção"


@pytest.mark.asyncio
@pytest.mark.parametrize("name", ["", "   ", "x" * 81])
async def test_patch_inbox_rejects_invalid_name(client, name):
    response = await client.patch("/api/inboxes/unknown-token", json={"name": name})

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_patch_inbox_returns_not_found(client):
    response = await client.patch("/api/inboxes/unknown-token", json={"name": "Novo nome"})

    assert response.status_code == 404
    assert response.json() == {"detail": "Endpoint não encontrado"}


@pytest.mark.asyncio
async def test_delete_inbox_removes_endpoint_and_events(client, database):
    await create_inbox_with_event(database)

    response = await client.delete("/api/inboxes/known-token")

    assert response.status_code == 204
    assert response.content == b""
    async with database() as session:
        assert await session.scalar(select(func.count()).select_from(Inbox)) == 0
        assert await session.scalar(select(func.count()).select_from(WebhookEvent)) == 0


@pytest.mark.asyncio
async def test_delete_inbox_returns_not_found(client):
    response = await client.delete("/api/inboxes/unknown-token")

    assert response.status_code == 404
    assert response.json() == {"detail": "Endpoint não encontrado"}
