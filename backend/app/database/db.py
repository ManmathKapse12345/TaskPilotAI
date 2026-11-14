"""Execution history storage (SQLite by default; any SQLAlchemy URL works, e.g. PostgreSQL)."""
from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, Text, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from app.core.config import settings

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def _now() -> datetime:
    return datetime.now(timezone.utc)


class TaskRecord(Base):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    prompt: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="queued")
    intent: Mapped[str | None] = mapped_column(String(40), nullable=True)
    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    tool: Mapped[str | None] = mapped_column(String(60), nullable=True)
    command: Mapped[str | None] = mapped_column(Text, nullable=True)
    exit_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    result_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    events_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    def summary(self) -> dict:
        return {
            "id": self.id, "created_at": self.created_at.isoformat() if self.created_at else None,
            "prompt": self.prompt[:200], "status": self.status, "intent": self.intent, "url": self.url,
            "duration_ms": self.duration_ms, "exit_code": self.exit_code,
        }

    def detail(self) -> dict:
        return {
            **self.summary(), "prompt": self.prompt, "tool": self.tool, "command": self.command, "error": self.error,
            "finished_at": self.finished_at.isoformat() if self.finished_at else None,
            "result": json.loads(self.result_json) if self.result_json else None,
            "events": json.loads(self.events_json) if self.events_json else [],
        }


def init_db() -> None:
    Base.metadata.create_all(engine)


def save_task(**fields) -> None:
    with SessionLocal.begin() as s:
        rec = s.get(TaskRecord, fields["id"])
        if rec is None:
            s.add(TaskRecord(**fields))
        else:
            for k, v in fields.items():
                setattr(rec, k, v)


def get_task(task_id: str) -> TaskRecord | None:
    with SessionLocal() as s:
        return s.get(TaskRecord, task_id)


def list_tasks(limit: int = 50) -> list[TaskRecord]:
    with SessionLocal() as s:
        return list(s.scalars(select(TaskRecord).order_by(TaskRecord.created_at.desc()).limit(limit)))


def delete_task(task_id: str) -> bool:
    with SessionLocal.begin() as s:
        rec = s.get(TaskRecord, task_id)
        if rec is None:
            return False
        s.delete(rec)
        return True
