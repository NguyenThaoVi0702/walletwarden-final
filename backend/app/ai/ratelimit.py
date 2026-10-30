import time
from collections import defaultdict, deque

from app.ai.interface import AIRateLimitError


class SlidingWindowLimiter:
    """In-memory per-user limit; enough for one backend process and 2-5 demo users."""

    def __init__(self, max_per_minute: int, window_s: float = 60.0) -> None:
        self._max = max_per_minute
        self._window = window_s
        self._hits: dict[int, deque[float]] = defaultdict(deque)

    def check(self, user_id: int) -> None:
        now = time.monotonic()
        hits = self._hits[user_id]
        while hits and now - hits[0] >= self._window:
            hits.popleft()
        if len(hits) >= self._max:
            raise AIRateLimitError(retry_after_s=int(self._window - (now - hits[0])) + 1)
        hits.append(now)
