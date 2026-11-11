import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { resetMockDb } from "../mocks/handlers";
import { server } from "../mocks/server";

// Pages are lazy-loaded: the first Vitest run compiles each chunk and needs more than the default 1 s.
configure({ asyncUtilTimeout: 5000 });

// jsdom has no ResizeObserver, which Recharts' ResponsiveContainer needs.
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
