from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class InboxCreate(BaseModel):
    name: str = Field(default="Meu endpoint", min_length=1, max_length=80)


class InboxCreated(BaseModel):
    token: str
    name: str
    hook_url: str
    dashboard_url: str
    expires_events_after_hours: int


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    method: str
    path: str
    query: dict
    headers: dict
    body: str
    content_type: str | None
    body_size: int
    source_ip_hint: str | None
    received_at: datetime


class InboxOut(BaseModel):
    name: str
    hook_url: str
    retention_hours: int
    events: list[EventOut]

