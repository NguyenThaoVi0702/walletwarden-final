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

/** Thêm alert mới vào danh sách, bỏ trùng id. */
function mergeAlerts(prev: RoastAlert[], incoming: RoastAlert[]): RoastAlert[] {
  return [...prev, ...incoming.filter((a) => !prev.some((p) => p.id === a.id))];
}

/**
 * Luồng Roast Mode (INTEGRATION.md §1.4):
 * tạo giao dịch → `roast_pending: true` → poll GET /api/ai/alerts?unread=true mỗi 2 s, tối đa 15 s
 * → hiện toast theo giọng → đóng thì POST /read, "Báo cáo" thì POST /report.
 * Khi mở app cũng kiểm tra 1 lần để không bỏ sót alert đến lúc người dùng đang ở trang khác.
 */
export function RoastProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<RoastAlert[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  /** Thêm alert mới (bỏ trùng id). Trả về true nếu có alert chưa đọc. */
  const pull = useCallback(async () => {
    try {
      const unread = await fetchUnreadAlerts();
      if (unread.length === 0) return false;
      setAlerts((prev) => mergeAlerts(prev, unread));
      return true;
    } catch {
      return false; // roast chỉ là phụ, lỗi mạng thì bỏ qua
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

  // Mở app: kiểm tra 1 lần alert chưa đọc (setState chạy trong .then, không đồng bộ trong effect).
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
