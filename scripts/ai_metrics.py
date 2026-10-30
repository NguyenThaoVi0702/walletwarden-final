"""Summarise logs/ai_calls.jsonl for the Metrics sheet (AI response time, fallback rate).

cd backend && uv run python ../scripts/ai_metrics.py            # all days
cd backend && uv run python ../scripts/ai_metrics.py --day 2026-11-12
"""

import argparse
import json
import statistics
import sys
from collections import Counter
from pathlib import Path

LOG = Path(__file__).resolve().parent.parent / "logs" / "ai_calls.jsonl"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--day", help="YYYY-MM-DD (UTC)")
    parser.add_argument("--log", type=Path, default=LOG)
    args = parser.parse_args()

    records = [json.loads(line) for line in args.log.read_text(encoding="utf-8").splitlines()]
    if args.day:
        records = [r for r in records if r["ts"].startswith(args.day)]
    if not records:
        print("No AI calls logged.")
        return

    latencies = sorted(r["latency_ms"] / 1000 for r in records)
    fallback = sum(r["fallback"] for r in records) / len(records)
    print(f"Calls:            {len(records)}")
    print(f"Median latency:   {statistics.median(latencies):.2f} s")
    print(f"Slowest:          {latencies[-1]:.2f} s")
    print(f"Fallback rate:    {fallback:.0%}   (action threshold: > 20% in a day)")
    print(f"By provider:      {dict(Counter(r['provider'] for r in records))}")
    print(f"By task:          {dict(Counter(r['task'] for r in records))}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]  # Windows console
    main()
