import {
  Navigate,
  Outlet,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import { Spinner } from "../components/Spinner";
import { useAuth } from "./useAuth";

/** Guards routes that need sign-in. Not signed in: go to /login?next=<current page>. */
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

/** Only allow redirects to internal paths (prevents open redirects via ?next=). */
function safeNext(next: string | null): string {
  // "/abc" is valid; "//evil.com" and "/\evil.com" (read by browsers as another domain) are not.
  return next && /^\/(?![/\\])/.test(next) ? next : "/";
}

/** Sign-in and register pages: signed-in users are sent into the app. The only place that navigates after sign-in. */
export function GuestOnly() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  return user ? (
    <Navigate to={safeNext(params.get("next"))} replace />
  ) : (
    <Outlet />
  );
}
