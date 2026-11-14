"""TaskPilot AI - FastAPI entry point.

Run:  uvicorn app.main:app --reload --port 8000   (from the backend/ folder)
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.config import settings
from app.database.db import init_db

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    logging.getLogger("taskpilot").info("TaskPilot ready - LLM provider: %s", settings.active_llm)
    yield


app = FastAPI(title="TaskPilot AI", version="1.0.0",
              description="Chat-to-CLI execution platform: natural language -> approved CLI tools -> verified results",
              lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["GET", "POST", "DELETE"],
                   allow_headers=["Content-Type"])
app.include_router(router)


@app.get("/")
def root() -> dict:
    return {"name": "TaskPilot AI", "docs": "/docs", "health": "/api/health"}
