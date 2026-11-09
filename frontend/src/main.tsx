import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

/** VITE_USE_MOCKS=true (xem .env.development) → MSW chặn mọi /api/* và trả dữ liệu mẫu. */
async function enableMocking() {
  if (import.meta.env.VITE_USE_MOCKS !== "true") return;
  const { worker } = await import("./mocks/browser");
  await worker.start({ onUnhandledFrame: "bypass", quiet: true });
  console.info(
    "[WalletWarden] MSW mock đang bật. Tài khoản: demo@walletwarden.vn / matkhau123",
  );
}

enableMocking().then(() =>
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
);
