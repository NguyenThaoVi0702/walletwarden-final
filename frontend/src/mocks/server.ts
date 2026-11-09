import { setupServer } from "msw/node";
import { handlers } from "./handlers";

/** Dùng trong Vitest (src/test/setup.ts). */
export const server = setupServer(...handlers);
