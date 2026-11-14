"""Minimal provider-agnostic LLM client (Gemini or OpenAI) over plain HTTPS.

Returns None on any failure so callers can fall back to deterministic logic.
API keys are sent only in headers and never logged.
"""
from __future__ import annotations

import json
import logging

import httpx

from app.core.config import settings
from app.core.security import redact

log = logging.getLogger("taskpilot.llm")


class LLMClient:
    def __init__(self) -> None:
        self.provider = settings.active_llm

    @property
    def enabled(self) -> bool:
        return self.provider != "none"

    @property
    def model(self) -> str | None:
        return {"gemini": settings.gemini_model, "openai": settings.openai_model}.get(self.provider)

    async def complete_json(self, system: str, user: str, temperature: float = 0.1) -> dict | None:
        text = await self._complete(system, user, temperature, json_mode=True)
        if not text:
            return None
        text = text.strip()
        if text.startswith("```"):
            text = text.strip("`").removeprefix("json").strip()
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            log.warning("LLM returned non-JSON output")
            return None
        return data if isinstance(data, dict) else None

    async def _complete(self, system: str, user: str, temperature: float, json_mode: bool) -> str | None:
        if not self.enabled:
            return None
        try:
            async with httpx.AsyncClient(timeout=settings.llm_timeout_seconds) as client:
                if self.provider == "gemini":
                    return await self._gemini(client, system, user, temperature, json_mode)
                return await self._openai(client, system, user, temperature, json_mode)
        except Exception as exc:  # network, quota, schema drift... -> graceful fallback
            log.warning("LLM call failed (%s): %s", self.provider, redact(str(exc))[:300])
            return None

    async def _gemini(self, client, system, user, temperature, json_mode) -> str | None:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent"
        gen_cfg = {"temperature": temperature}
        if json_mode:
            gen_cfg["responseMimeType"] = "application/json"
        body = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": gen_cfg,
        }
        resp = await client.post(url, json=body, headers={"x-goog-api-key": settings.gemini_api_key})
        resp.raise_for_status()
        data = resp.json()
        parts = data["candidates"][0]["content"]["parts"]
        return "".join(p.get("text", "") for p in parts)

    async def _openai(self, client, system, user, temperature, json_mode) -> str | None:
        body = {
            "model": settings.openai_model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "temperature": temperature,
        }
        if json_mode:
            body["response_format"] = {"type": "json_object"}
        resp = await client.post(
            "https://api.openai.com/v1/chat/completions", json=body,
            headers={"Authorization": f"Bearer {settings.openai_api_key}"},
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]


llm = LLMClient()
