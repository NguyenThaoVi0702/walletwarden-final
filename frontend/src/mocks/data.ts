/** One month of sample data for MSW and tests. */
import type { BudgetInput, Category, Transaction, User } from "../api/types";
import { currentMonth } from "../lib/format";

export const DEMO_EMAIL = "demo@walletwarden.vn";
export const DEMO_PASSWORD = "matkhau123";

export interface MockAccount {
  user: User;
  password: string;
}

export const seedAccounts = (): MockAccount[] => [
  {
    password: DEMO_PASSWORD,
    user: {
      id: 1,
      email: DEMO_EMAIL,
      display_name: "Bạn Demo",
      roast_enabled: true,
      roast_tone: "honest",
    },
  },
];

/** Default categories created on registration (mirrors backend services/defaults.py). */
export const seedCategories = (): Category[] =>
  (
    [
      { id: 1, name: "Ăn uống", kind: "expense", icon: "🍜", color: "#2a78d6" },
      {
        id: 2,
        name: "Di chuyển",
        kind: "expense",
        icon: "🛵",
        color: "#eb6834",
      },
      { id: 3, name: "Nhà ở", kind: "expense", icon: "🏠", color: "#1baf7a" },
      { id: 4, name: "Hóa đơn", kind: "expense", icon: "🧾", color: "#eda100" },
      { id: 5, name: "Mua sắm", kind: "expense", icon: "🛍️", color: "#e87ba4" },
      {
        id: 6,
        name: "Giải trí",
        kind: "expense",
        icon: "🎮",
        color: "#008300",
      },
      {
        id: 7,
        name: "Sức khỏe",
        kind: "expense",
        icon: "💊",
        color: "#6250d6",
      },
      {
        id: 8,
        name: "Giáo dục",
        kind: "expense",
        icon: "📚",
        color: "#e34948",
      },
      { id: 9, name: "Khác", kind: "expense", icon: "📦", color: "#8b8f98" },
      { id: 10, name: "Lương", kind: "income", icon: "💼", color: "#008300" },
      { id: 11, name: "Thưởng", kind: "income", icon: "🎁", color: "#eda100" },
      {
        id: 12,
        name: "Thu nhập khác",
        kind: "income",
        icon: "💰",
        color: "#1baf7a",
      },
    ] as const
  ).map((c) => ({ ...c, is_default: true }));

/** [day of month, kind, amount, category_id, note] */
const TX_TEMPLATE: [
  number,
  Transaction["kind"],
  number,
  number,
  string | null,
][] = [
  [1, "income", 12_000_000, 10, "Lương tháng"],
  [1, "expense", 3_500_000, 3, "Tiền phòng"],
  [2, "expense", 45_000, 1, "Trà sữa"],
  [2, "expense", 35_000, 1, "Cơm trưa"],
  [3, "expense", 50_000, 2, "Đổ xăng"],
  [3, "expense", 420_000, 4, "Tiền điện"],
  [4, "expense", 89_000, 1, "Bún bò"],
  [5, "expense", 650_000, 5, "Áo khoác"],
  [5, "expense", 45_000, 1, "Trà sữa"],
  [6, "expense", 180_000, 6, "Xem phim"],
  [7, "expense", 120_000, 4, "Internet"],
  [8, "expense", 250_000, 7, "Thuốc cảm"],
  [9, "expense", 55_000, 1, "Phở"],
  [10, "expense", 1_200_000, 8, "Khóa học online"],
  [11, "expense", 30_000, 2, "Grab"],
  [12, "expense", 320_000, 1, "Lẩu với bạn"],
  [13, "income", 1_500_000, 12, "Freelance"],
  [14, "expense", 1_800_000, 6, "Vé concert"],
  [15, "expense", 45_000, 1, "Trà sữa"],
  [16, "expense", 99_000, 9, null],
  [18, "expense", 60_000, 2, "Gửi xe tháng"],
  [20, "expense", 540_000, 5, "Giày"],
  [22, "expense", 75_000, 1, "Bánh mì + cà phê"],
  [25, "income", 500_000, 11, "Thưởng dự án"],
  [26, "expense", 210_000, 1, "Đi chợ"],
];

/** Transactions of `month` (default: current); up to today for the current month. */
export function seedTransactions(
  month: string = currentMonth(),
  today: Date = new Date(),
): Transaction[] {
  const isThisMonth = month === currentMonth(today);
  return TX_TEMPLATE.filter(
    ([day]) => !isThisMonth || day <= today.getDate(),
  ).map(([day, kind, amount, category_id, note], i) => ({
    id: i + 1,
    kind,
    amount,
    category_id,
    date: `${month}-${String(day).padStart(2, "0")}`,
    note,
  }));
}

export const seedBudget = (month: string = currentMonth()): BudgetInput => ({
  month,
  total: 9_000_000,
  categories: [
    { category_id: 1, limit: 1_500_000 },
    { category_id: 2, limit: 400_000 },
    { category_id: 5, limit: 1_000_000 },
    { category_id: 6, limit: 1_500_000 },
  ],
});
