from typing import Protocol

from app.ai.interface import ProviderName

Message = dict[str, str]


class ProviderError(Exception):
    """The provider did not produce an answer (down, timeout, quota, bad response)."""


class LLMProvider(Protocol):
    name: ProviderName

    async def complete(
        self,
        messages: list[Message],
        *,
        max_tokens: int,
        temperature: float,
        json_mode: bool = False,
    ) -> str:
        """Return the raw text of the model's reply or raise ProviderError."""
        ...

    async def ping(self) -> bool: ...
