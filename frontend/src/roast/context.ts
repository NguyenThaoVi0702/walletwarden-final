import { createContext, useContext } from "react";

export interface RoastState {
  /** Gọi sau khi tạo giao dịch có `roast_pending: true`: poll alert chưa đọc 2 s/lần, tối đa 15 s. */
  watchForRoast: () => void;
}

export const RoastContext = createContext<RoastState | null>(null);

/** Thời gian poll (test có thể giảm cho nhanh). */
export const roastPolling = { intervalMs: 2000, maxMs: 15_000 };

export function useRoast(): RoastState {
  const ctx = useContext(RoastContext);
  if (!ctx)
    throw new Error("useRoast phải được dùng bên trong <RoastProvider>");
  return ctx;
}
