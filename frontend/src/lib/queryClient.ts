import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/client";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Do not retry 4xx errors (401, 404, 422, 429…); retry network and 5xx errors once.
        retry: (count, err) =>
          !(err instanceof ApiError && err.status < 500) && count < 1,
      },
    },
  });
}
