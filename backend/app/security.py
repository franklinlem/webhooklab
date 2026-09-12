import hashlib
import hmac
import secrets

SENSITIVE_HEADERS = {
    "authorization",
    "cookie",
    "proxy-authorization",
    "set-cookie",
    "x-api-key",
    "x-auth-token",
}


def new_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str, secret: str) -> str:
    return hmac.new(secret.encode(), token.encode(), hashlib.sha256).hexdigest()


def mask_headers(headers: dict[str, str]) -> dict[str, str]:
    return {
        key: "••••••••" if key.lower() in SENSITIVE_HEADERS else value[:4096]
        for key, value in headers.items()
    }


def ip_hint(ip: str | None) -> str | None:
    if not ip:
        return None
    if ":" in ip:
        return ":".join(ip.split(":")[:4]) + "::/64"
    parts = ip.split(".")
    return ".".join(parts[:3] + ["0/24"]) if len(parts) == 4 else None

