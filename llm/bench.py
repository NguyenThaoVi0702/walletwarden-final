"""Quick benchmark of the running llama-server (T05 / T22).

Measures reply latency and tokens/s with 1 and N simultaneous requests,
using a real roast prompt so the numbers match what users will see.

    cd backend && uv run python ../llm/bench.py --concurrency 1 4 5
"""

import argparse
import asyncio
import statistics
import sys
import time
from pathlib import Path

from openai import AsyncOpenAI

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.ai.interface import RoastContext, RoastTrigger, Tone  # noqa: E402
from app.ai.prompts import PromptBuilder  # noqa: E402
from app.config import get_settings  # noqa: E402

CTX = RoastContext(
    trigger=RoastTrigger.BUDGET_80,
    tone=Tone.SAVAGE,
    category="Ăn uống",
    amount=120_000,
    spent=2_050_000,
    budget=2_500_000,
    usage_pct=82,
    days_left=10,
)


async def one(client: AsyncOpenAI, model: str, messages: list[dict[str, str]]) -> tuple[float, int]:
    start = time.perf_counter()
    resp = await client.chat.completions.create(
        model=model,
        messages=messages,  # type: ignore[arg-type]
        max_tokens=160,
        temperature=0.9,
        extra_body={"chat_template_kwargs": {"enable_thinking": False}},
    )
    tokens = resp.usage.completion_tokens if resp.usage else 0
    return time.perf_counter() - start, tokens


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--concurrency", type=int, nargs="+", default=[1, 4])
    parser.add_argument("--rounds", type=int, default=3)
    args = parser.parse_args()

    settings = get_settings()
    client = AsyncOpenAI(base_url=settings.llama_base_url, api_key="x", timeout=120)
    messages = PromptBuilder(settings.prompts_dir).roast(CTX)
    print(
        "Sample reply:",
        (
            await client.chat.completions.create(
                model=settings.llama_model,
                messages=messages,
                max_tokens=160,  # type: ignore[arg-type]
                extra_body={"chat_template_kwargs": {"enable_thinking": False}},
            )
        )
        .choices[0]
        .message.content,
    )

    for n in args.concurrency:
        latencies: list[float] = []
        tps: list[float] = []
        tokens: list[int] = []
        for _ in range(args.rounds):
            results = await asyncio.gather(
                *(one(client, settings.llama_model, messages) for _ in range(n))
            )
            latencies += [t for t, _ in results]
            tps += [tok / t for t, tok in results if t > 0]
            tokens += [tok for _, tok in results]
        print(
            f"{n} user(s): median {statistics.median(latencies):.2f}s, "
            f"slowest {max(latencies):.2f}s, {statistics.mean(tps):.1f} tok/s per user, "
            f"{statistics.mean(tokens):.0f} tokens per reply"
        )


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]  # Windows console
    asyncio.run(main())
