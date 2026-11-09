import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { Icon } from "../components/Icon";
import { RoastProvider } from "../roast/RoastProvider";
import { NAV_ITEMS } from "./nav";

/**
 * Khung app sau đăng nhập.
 * - ≥ 768px (md): sidebar navy cố định bên trái + nội dung rộng.
 * - < 768px: header navy trên cùng + bottom navigation 5 mục.
 */
export function AppLayout() {
  const { user, signOut } = useAuth();
  const { pathname } = useLocation();
  const current = NAV_ITEMS.find((i) =>
    i.to === "/" ? pathname === "/" : pathname.startsWith(i.to),
  );

  return (
    <RoastProvider>
      <div className="min-h-svh md:flex">
        {/* Sidebar: desktop / tablet */}
        <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col bg-navy text-white md:flex">
          <div className="flex items-center gap-3 px-5 py-5">
            <img
              src="/logo-64.png"
              alt=""
              width={36}
              height={36}
              className="rounded-lg"
            />
            <span className="text-lg font-semibold tracking-tight">
              WalletWarden
            </span>
          </div>

          <nav aria-label="Điều hướng chính" className="flex-1 space-y-1 px-3">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-green text-navy"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  }`
                }
              >
                <Icon name={item.icon} />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="border-t border-white/10 px-5 py-4 text-sm">
            <p className="truncate font-medium">{user?.display_name}</p>
            <p className="truncate text-white/60">{user?.email}</p>
            <button
              type="button"
              onClick={signOut}
              className="mt-3 flex items-center gap-2 text-white/80 hover:text-white"
            >
              <Icon name="logout" className="size-4" />
              Đăng xuất
            </button>
          </div>
        </aside>

        {/* Header: điện thoại */}
        <header className="sticky top-0 z-10 flex items-center gap-3 bg-navy px-4 py-3 text-white md:hidden">
          <img
            src="/logo-64.png"
            alt=""
            width={32}
            height={32}
            className="rounded-md"
          />
          <span className="font-semibold">
            {current?.label ?? "WalletWarden"}
          </span>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 pb-24 md:px-8 md:pt-8 md:pb-8">
          <Outlet />
        </main>

        {/* Bottom nav: điện thoại */}
        <nav
          aria-label="Điều hướng nhanh"
          className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-navy/10 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          {NAV_ITEMS.filter((i) => i.mobile).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                  isActive ? "text-green-700" : "text-navy/60"
                }`
              }
            >
              <Icon name={item.icon} className="size-6" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </RoastProvider>
  );
}
