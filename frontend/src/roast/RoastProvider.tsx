import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { fetchUnreadAlerts, markAlertRead, reportAlert } from "../api/hooks";
import type { RoastAlert } from "../api/types";
import { RoastContext, roastPolling, type RoastState } from "./context";
import { RoastToast } from "./RoastToast";

/** Add new alerts, skipping duplicate ids. */
function mergeAlerts(prev: RoastAlert[], incoming: RoastAlert[]): RoastAlert[] {
  return [...prev, ...incoming.filter((a) => !prev.some((p) => p.id === a.id))];
}

/**
 * Roast flow: create a transaction → `roast_pending: true` → poll
 * GET /api/ai/alerts?unread=true every 2 s for up to 15 s → show a toast in the matching tone →
 * closing sends POST /read, "Báo cáo" sends POST /report.
 * Also checks once when the app opens, so alerts that arrived while on another page are not missed.
 */
export function RoastProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<RoastAlert[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  /** Add new alerts (skipping duplicates). Returns true if any is unread. */
  const pull = useCallback(async () => {
    try {
      const unread = await fetchUnreadAlerts();
      if (unread.length === 0) return false;
      setAlerts((prev) => mergeAlerts(prev, unread));
      return true;
    } catch {
      return false; // roast is secondary; ignore network errors
    }
  }, []);

  const watchForRoast = useCallback(() => {
    stop();
    const startedAt = Date.now();
    timer.current = setInterval(async () => {
      const found = await pull();
      if (found || Date.now() - startedAt >= roastPolling.maxMs) stop();
    }, roastPolling.intervalMs);
  }, [pull, stop]);

  // On open: check unread alerts once (setState runs in .then, not synchronously in the effect).
  useEffect(() => {
    let cancelled = false;
    fetchUnreadAlerts()
      .then((unread) => {
        if (!cancelled && unread.length)
          setAlerts((prev) => mergeAlerts(prev, unread));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      stop();
    };
  }, [stop]);

  const dismiss = useCallback((id: number) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    void markAlertRead(id).catch(() => {});
  }, []);

  const value = useMemo<RoastState>(() => ({ watchForRoast }), [watchForRoast]);

  return (
    <RoastContext.Provider value={value}>
      {children}
      {/* Trên điện thoại nằm trên bottom nav; desktop ở góc phải dưới. */}
      <div
        aria-live="assertive"
        className="pointer-events-none fixed inset-x-3 bottom-20 z-30 flex flex-col gap-2 md:inset-x-auto md:right-6 md:bottom-6 md:w-96"
      >
        {alerts.map((a) => (
          <RoastToast
            key={a.id}
            alert={a}
            onClose={() => dismiss(a.id)}
            onReport={() => reportAlert(a.id)}
          />
        ))}
      </div>
    </RoastContext.Provider>
  );
}
