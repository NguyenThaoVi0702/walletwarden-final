"""Run the 30-case AI test set and write a rating sheet for reviewers.

Usage (from /backend):
    uv run python ../scripts/run_ai_testset.py                     # simulated AI (rules)
    uv run python ../scripts/run_ai_testset.py --providers local   # llama.cpp only
    uv run python ../scripts/run_ai_testset.py --providers local,gemini

Output: prompts/testset/results/<timestamp>_<providers>.md (+ .csv)
Fill the `rater_1` / `rater_2` columns with Y or N to score the run.
"""

import argparse
import asyncio
import csv
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any

import yaml

BACKEND = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND))

from app.ai.interface import AdviceRequest, FinancialSummary, RoastContext  # noqa: E402
from app.ai.service import DefaultAIService  # noqa: E402
from app.config import REPO_ROOT, Settings  # noqa: E402

CASES_FILE = REPO_ROOT / "prompts" / "testset" / "cases.yaml"


def load_cases() -> dict[str, Any]:
    return yaml.safe_load(CASES_FILE.read_text(encoding="utf-8"))  # type: ignore[no-any-return]


async def run_case(
    ai: DefaultAIService, case: dict[str, Any], data: dict[str, Any], user_id: int
) -> dict[str, Any]:
    summaries, task = data["summaries"], case["task"]
    start = time.perf_counter()
    auto_ok = ""
    if task == "advice":
        summary = FinancialSummary.model_validate(summaries[case["summary"]])
        r = await ai.advise(user_id, AdviceRequest(summary=summary, question=case["question"]))
        text, provider, prompt = r.text, r.provider, case["question"]
    elif task == "roast":
        ctx = RoastContext.model_validate(case["context"])
        r = await ai.roast(user_id, ctx)
        text, provider, prompt = r.text, r.provider, f"{ctx.trigger}/{ctx.tone}"
    elif task == "report":
        summary = FinancialSummary.model_validate(summaries[case["summary"]])
        rep = await ai.monthly_report(user_id, summary)
        text = f"{rep.headline} | {rep.commentary} | Mẹo: {rep.saving_tip}"
        provider, prompt = rep.provider, case["summary"]
    elif task == "quick_entry":
        entry = await ai.parse_entry(user_id, case["text"], data["categories"])
        got = entry.model_dump(include={"kind", "amount", "category"}) if entry else None
        text = str(got)
        provider = entry.provider if entry else "-"
        prompt = case["text"]
        auto_ok = "Y" if got == case["expect"] else "N"
    else:
        raise ValueError(f"unknown task {task}")
    return {
        "id": case["id"],
        "task": task,
        "input": prompt,
        "provider": provider,
        "seconds": round(time.perf_counter() - start, 2),
        "reply": text,
        "expect": case["expect"] if isinstance(case["expect"], str) else str(case["expect"]),
        "auto_check": auto_ok,
        "rater_1": "",
        "rater_2": "",
    }


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--providers", default="fake", help="e.g. fake | local | local,gemini")
    parser.add_argument("--only", help="comma-separated case ids, e.g. R01,R03")
    args = parser.parse_args()

    settings = Settings(ai_providers=args.providers, ai_rate_limit_per_minute=10_000)
    ai = DefaultAIService(settings)
    data = load_cases()
    cases = data["cases"]
    if args.only:
        wanted = set(args.only.split(","))
        cases = [c for c in cases if c["id"] in wanted]

    rows = []
    for i, case in enumerate(cases):
        row = await run_case(ai, case, data, user_id=900 + i)
        rows.append(row)
        print(f"{row['id']} [{row['provider']}, {row['seconds']}s] {row['reply'][:110]}")

    out_dir = REPO_ROOT / "prompts" / "testset" / "results"
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = f"{datetime.now():%Y%m%d-%H%M}_{args.providers.replace(',', '+')}"
    with (out_dir / f"{stem}.csv").open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    md = [
        f"# AI test set – {args.providers} – {datetime.now():%Y-%m-%d %H:%M}",
        "",
        "| ID | Provider | s | Reply | Expect | Auto | R1 | R2 |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for r in rows:
        reply = r["reply"].replace("|", "/").replace("\n", " ")
        md.append(
            f"| {r['id']} | {r['provider']} | {r['seconds']} | {reply} | {r['expect']} "
            f"| {r['auto_check']} |  |  |"
        )
    (out_dir / f"{stem}.md").write_text("\n".join(md) + "\n", encoding="utf-8")

    fallback = sum(r["provider"] in ("rules", "gemini") for r in rows) / len(rows)
    times = sorted(r["seconds"] for r in rows)
    auto = [r for r in rows if r["auto_check"]]
    print(f"\nWrote {out_dir / stem}.md/.csv")
    print(f"Median {times[len(times) // 2]}s, slowest {times[-1]}s, fallback rate {fallback:.0%}")
    if auto:
        print(f"Quick-entry auto check: {sum(r['auto_check'] == 'Y' for r in auto)}/{len(auto)}")
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]  # Windows console
    sys.exit(asyncio.run(main()))
