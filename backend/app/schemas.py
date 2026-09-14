from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class InboxCreate(BaseModel):
    name: str = Field(default="Meu endpoint", min_length=1, max_length=80)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        name = value.strip()
        if not name:
            raise ValueError("O nome não pode estar vazio")
        return name


class InboxUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=80)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        name = value.strip()
        if not name:
            raise ValueError("O nome não pode estar vazio")
        return name


class InboxUpdated(BaseModel):
    name: str


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
