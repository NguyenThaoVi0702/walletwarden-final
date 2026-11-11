import { createContext, useContext } from "react";

export interface RoastState {
  /** Call after creating a transaction with `roast_pending: true`: polls unread alerts every 2 s for up to 15 s. */
  watchForRoast: () => void;
}

export const RoastContext = createContext<RoastState | null>(null);

/** Poll timing (tests can shorten it). */
export const roastPolling = { intervalMs: 2000, maxMs: 15_000 };

export function useRoast(): RoastState {
  const ctx = useContext(RoastContext);
  if (!ctx)
    throw new Error("useRoast phải được dùng bên trong <RoastProvider>");
  return ctx;
}
