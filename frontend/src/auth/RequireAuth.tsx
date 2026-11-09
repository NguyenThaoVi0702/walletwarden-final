import {
  Navigate,
  Outlet,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import { Spinner } from "../components/Spinner";
import { useAuth } from "./useAuth";

/** Chặn các route cần đăng nhập. Chưa đăng nhập → /login?next=<trang đang mở>. */
export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="grid min-h-svh place-items-center">
        <Spinner label="Đang tải…" />
      </div>
    );
  }
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <Outlet />;
}

/** Chỉ cho phép quay lại đường dẫn nội bộ (tránh open redirect qua ?next=). */
function safeNext(next: string | null): string {
  // "/abc" hợp lệ; "//evil.com" và "/\evil.com" (trình duyệt hiểu là domain khác) thì không.
  return next && /^\/(?![/\\])/.test(next) ? next : "/";
}

/**
 * Trang đăng nhập/đăng ký: đã đăng nhập thì vào app (trang `?next=` nếu có).
 * Đây là nơi DUY NHẤT điều hướng sau khi đăng nhập, Login/Register chỉ gọi signIn().
 */
export function GuestOnly() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  return user ? (
    <Navigate to={safeNext(params.get("next"))} replace />
  ) : (
    <Outlet />
  );
}
