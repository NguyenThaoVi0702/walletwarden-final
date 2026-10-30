"""Gemini API fallback (free tier), used only when the local model does not answer."""

import asyncio

from google import genai
from google.genai import errors, types

from app.ai.interface import ProviderName
from app.ai.providers.base import Message, ProviderError


class GeminiProvider:
    name: ProviderName = "gemini"

    def __init__(self, api_key: str, model: str, timeout_s: float) -> None:
        self._client = genai.Client(api_key=api_key)
        self._model = model
        self._timeout_s = timeout_s

    async def complete(
        self,
        messages: list[Message],
        *,
        max_tokens: int,
        temperature: float,
        json_mode: bool = False,
    ) -> str:
        system = "\n\n".join(m["content"] for m in messages if m["role"] == "system")
        contents = [
            types.Content(
                role="model" if m["role"] == "assistant" else "user",
                parts=[types.Part(text=m["content"])],
            )
            for m in messages
            if m["role"] != "system"
        ]
        config = types.GenerateContentConfig(
            system_instruction=system or None,
            max_output_tokens=max_tokens,
            temperature=temperature,
            response_mime_type="application/json" if json_mode else None,
            thinking_config=types.ThinkingConfig(thinking_budget=0),
        )
        try:
            async with asyncio.timeout(self._timeout_s):
                resp = await self._client.aio.models.generate_content(
                    model=self._model, contents=contents, config=config
                )
        except (errors.APIError, TimeoutError) as exc:
            raise ProviderError(f"gemini: {exc.__class__.__name__}: {exc}") from exc
        if not resp.text:
            raise ProviderError("gemini: empty reply")
        return resp.text

    async def ping(self) -> bool:
        # Pinging would spend free-tier quota; a configured key is enough for the health page.
        return True
