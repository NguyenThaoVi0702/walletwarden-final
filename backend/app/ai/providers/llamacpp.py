"""Local model served by llama.cpp `llama-server` (OpenAI-compatible API)."""

import asyncio
from typing import Any, cast

import httpx
from openai import AsyncOpenAI, OpenAIError

from app.ai.interface import ProviderName
from app.ai.providers.base import Message, ProviderError


class LlamaCppProvider:
    name: ProviderName = "local"

    def __init__(self, base_url: str, model: str, timeout_s: float, max_concurrency: int) -> None:
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._timeout_s = timeout_s
        # llama-server runs a fixed number of parallel slots (-np); queue here instead of there
        # so a 5th user waits a little rather than timing out inside the server.
        self._slots = asyncio.Semaphore(max_concurrency)
        self._client = AsyncOpenAI(
            base_url=self._base_url, api_key="not-needed", timeout=timeout_s, max_retries=0
        )

    async def complete(
        self,
        messages: list[Message],
        *,
        max_tokens: int,
        temperature: float,
        json_mode: bool = False,
    ) -> str:
        kwargs: dict[str, Any] = {
            "model": self._model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            # Qwen-style models: skip the hidden "thinking" pass, we want short answers fast.
            "extra_body": {"chat_template_kwargs": {"enable_thinking": False}},
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        try:
            async with asyncio.timeout(self._timeout_s), self._slots:
                resp = await self._client.chat.completions.create(**cast(Any, kwargs))
        except (OpenAIError, TimeoutError) as exc:
            raise ProviderError(f"llama.cpp: {exc.__class__.__name__}: {exc}") from exc
        text: str | None = resp.choices[0].message.content if resp.choices else None
        if not text:
            raise ProviderError("llama.cpp: empty reply")
        return text

    async def ping(self) -> bool:
        health_url = self._base_url.removesuffix("/v1") + "/health"
        try:
            async with httpx.AsyncClient(timeout=2) as client:
                return (await client.get(health_url)).status_code == 200
        except httpx.HTTPError:
            return False
