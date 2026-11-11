import type { IconName } from "../components/Icon";

export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  /** Shown in the phone bottom navigation (max 5 items); the others are reached from Settings. */
  mobile: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Tổng quan", icon: "dashboard", mobile: true },
  {
    to: "/transactions",
    label: "Giao dịch",
    icon: "transactions",
    mobile: true,
  },
  { to: "/budgets", label: "Ngân sách", icon: "budgets", mobile: true },
  { to: "/advisor", label: "Trợ lý AI", icon: "advisor", mobile: true },
  { to: "/categories", label: "Danh mục", icon: "categories", mobile: false },
  { to: "/report", label: "Báo cáo tháng", icon: "report", mobile: false },
  { to: "/settings", label: "Cài đặt", icon: "settings", mobile: true },
];
