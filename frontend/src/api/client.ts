import createClient from "openapi-fetch";
import type { paths } from "./schema";

const TOKEN_KEY = "ww_token";

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
  },
};

/** Lỗi HTTP từ API. `detail` theo dạng mặc định của FastAPI `{"detail": ...}`. */
export class ApiError extends Error {
  readonly status: number;
  readonly detail: unknown;
  /** Chỉ có khi status 429 (AI bận): số giây đọc từ header Retry-After. */
  readonly retryAfter: number | null;

  constructor(
    status: number,
    detail: unknown,
    retryAfter: number | null = null,
  ) {
    super(typeof detail === "string" ? detail : `HTTP ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.retryAfter = retryAfter;
  }
}

/** Gọi khi API trả 401 (token hết hạn / sai). AuthProvider đăng ký hàm này để về trang đăng nhập. */
let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

function authHeader(headers: Headers) {
  const token = tokenStore.get();
  if (token) headers.set("Authorization", `Bearer ${token}`);
}

function parseRetryAfter(res: Response): number | null {
  const raw = res.headers.get("Retry-After");
  if (!raw) return null;
  const secs = Number(raw);
  return Number.isFinite(secs) ? Math.max(0, Math.ceil(secs)) : null;
}

async function toApiError(res: Response): Promise<ApiError> {
  let detail: unknown = res.statusText;
  try {
    const body: unknown = await res.json();
    if (body && typeof body === "object" && "detail" in body)
      detail = body.detail;
  } catch {
    // body không phải JSON
  }
  return new ApiError(
    res.status,
    detail,
    res.status === 429 ? parseRetryAfter(res) : null,
  );
}

/**
 * Client có type sinh từ backend/openapi.json (src/api/schema.d.ts).
 * Dùng cho các endpoint đã có trong openapi.json: `api.GET("/api/health")`.
 */
export const api = createClient<paths>({ baseUrl: "/" });
api.use({
  onRequest({ request }) {
    authHeader(request.headers);
    return request;
  },
  onResponse({ response }) {
    if (response.status === 401) onUnauthorized();
    return response;
  },
});

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Fetch có JWT + xử lý lỗi chung, dùng cho các endpoint chưa có trong openapi.json.
 * Ném `ApiError` khi status không 2xx. 204 → trả `undefined`.
 */
export async function request<T>(
  method: Method,
  path: string,
  options: {
    body?: unknown;
    query?: Record<string, string | number | boolean | undefined>;
  } = {},
): Promise<T> {
  const url = new URL(path, window.location.origin);
  for (const [k, v] of Object.entries(options.query ?? {})) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }

  const headers = new Headers({ Accept: "application/json" });
  authHeader(headers);
  if (options.body !== undefined)
    headers.set("Content-Type", "application/json");

  const res = await fetch(url, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    // Không đá người dùng ra khi chính lệnh đăng nhập trả 401 (sai mật khẩu).
    if (res.status === 401 && !path.startsWith("/api/auth/")) onUnauthorized();
    throw await toApiError(res);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Tải file (vd. CSV) có kèm JWT rồi cho trình duyệt lưu với tên `filename`. */
export async function downloadFile(
  path: string,
  filename: string,
  query: Record<string, string> = {},
): Promise<void> {
  const url = new URL(path, window.location.origin);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const headers = new Headers();
  authHeader(headers);
  const res = await fetch(url, { headers });
  if (!res.ok) {
    if (res.status === 401) onUnauthorized();
    throw await toApiError(res);
  }
  const href = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
}

/**
 * Câu `detail` tiếng Anh mà backend trả (PR #42, backend/app/api/*.py) → tiếng Việt.
 * Backend thêm lỗi mới thì bổ sung vào đây; câu chưa có sẽ hiện nguyên văn.
 */
const DETAIL_VI: Record<string, string> = {
  "Invalid email or password": "Email hoặc mật khẩu không đúng.",
  "Email already registered": "Email này đã được đăng ký.",
  "Could not validate credentials":
    "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.",
  "Category name already exists": "Danh mục này đã tồn tại.",
  "Category name cannot be empty": "Tên danh mục không được để trống.",
  "Category is in use":
    "Danh mục đang được dùng (có giao dịch hoặc ngân sách), không thể xoá.",
  "Category not found": "Không tìm thấy danh mục.",
  "Transaction not found": "Không tìm thấy giao dịch.",
  "Transaction kind must match category kind":
    "Loại giao dịch (thu/chi) không khớp với danh mục.",
  "Duplicate category budget": "Một danh mục bị đặt ngân sách hai lần.",
  "Expense category not found": "Không tìm thấy danh mục chi.",
  "Alert not found": "Không tìm thấy thông báo.",
  "Could not find an amount in the entry":
    'Không thấy số tiền trong câu, thử ghi rõ như "trà sữa 45k".',
  "Could not determine a matching category":
    "Chưa đoán được danh mục, bạn chọn giúp nhé.",
};

/** Thông báo lỗi tiếng Việt để hiện cho người dùng. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 429) {
      return `Bạn hỏi hơi nhanh, thử lại sau ${err.retryAfter ?? 30} giây.`;
    }
    if (typeof err.detail === "string")
      return DETAIL_VI[err.detail] ?? err.detail;
    // 422 do Pydantic kiểm tra: detail là mảng [{loc, msg, type}]
    if (err.status === 422)
      return "Dữ liệu chưa hợp lệ, kiểm tra lại các ô đã nhập.";
    if (err.status >= 500) return "Máy chủ đang gặp sự cố, thử lại sau nhé.";
    return `Có lỗi xảy ra (HTTP ${err.status}).`;
  }
  if (err instanceof TypeError) return "Không kết nối được máy chủ.";
  return "Có lỗi xảy ra, thử lại sau nhé.";
}
