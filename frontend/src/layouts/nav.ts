import type { IconName } from "../components/Icon";

export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  /** Hiện ở bottom nav trên điện thoại (tối đa 5 mục). Các mục khác vào từ Cài đặt. */
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
