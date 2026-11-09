import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { resetMockDb } from "../mocks/handlers";
import { server } from "../mocks/server";

// Trang được lazy-load: lần đầu Vitest phải biên dịch chunk nên cần quá 1 s mặc định.
configure({ asyncUtilTimeout: 5000 });

// jsdom không có ResizeObserver mà ResponsiveContainer của Recharts cần.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
beforeEach(() => {
  resetMockDb();
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
