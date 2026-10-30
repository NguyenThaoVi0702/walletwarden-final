"""One JSON line per AI call: feeds the response-time and fallback-rate metrics.

Only technical data is logged (task, provider, latency, errors), never prompt text.
"""

import json
import logging
import threading
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

log = logging.getLogger("walletwarden.ai")


class CallLog:
    def __init__(self, path: Path | None) -> None:
        self._path = path
        self._lock = threading.Lock()
        if path:
            path.parent.mkdir(parents=True, exist_ok=True)

    def write(self, **record: Any) -> None:
        record = {"ts": datetime.now(UTC).isoformat(timespec="milliseconds"), **record}
        log.info("ai_call %s", record)
        if not self._path:
            return
        line = json.dumps(record, ensure_ascii=False)
        with self._lock, self._path.open("a", encoding="utf-8") as f:
            f.write(line + "\n")
