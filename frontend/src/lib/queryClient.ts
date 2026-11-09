import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/client";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Không thử lại lỗi 4xx (401, 404, 422, 429…), chỉ thử lại lỗi mạng / 5xx một lần.
        retry: (count, err) =>
          !(err instanceof ApiError && err.status < 500) && count < 1,
      },
    },
  });
}
