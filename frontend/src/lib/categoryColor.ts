/**
 * Category colors. Users pick a color per category and every chart uses it.
 * The 8 colors are a validated categorical palette (distinguishable for color-blind users),
 * in this order; gray is for "Khác" / "Còn lại". The backend (services/defaults.py) assigns
 * them to the default categories.
 */
export const CATEGORY_COLORS = [
  { value: "#2a78d6", label: "Xanh dương" },
  { value: "#eb6834", label: "Cam" },
  { value: "#1baf7a", label: "Xanh ngọc" },
  { value: "#eda100", label: "Vàng" },
  { value: "#e87ba4", label: "Hồng" },
  { value: "#008300", label: "Xanh lá" },
  { value: "#6250d6", label: "Tím" },
  { value: "#e34948", label: "Đỏ" },
] as const;

export const OTHER_COLOR = "#8b8f98";

/** Accounts created before colors existed: default categories get the colors the backend assigns. */
const DEFAULT_BY_NAME: Record<string, string> = {
  "Ăn uống": "#2a78d6",
  "Di chuyển": "#eb6834",
  "Nhà ở": "#1baf7a",
  "Hóa đơn": "#eda100",
  "Mua sắm": "#e87ba4",
  "Giải trí": "#008300",
  "Sức khỏe": "#6250d6",
  "Giáo dục": "#e34948",
  Khác: OTHER_COLOR,
  Lương: "#008300",
  Thưởng: "#eda100",
  "Thu nhập khác": "#1baf7a",
};

const HEX = /^#[0-9a-f]{6}$/i;

type ColoredCategory = { id: number; name: string; color?: string | null };

export function categoryColor(category: ColoredCategory | undefined): string {
  if (!category) return OTHER_COLOR;
  if (category.color && HEX.test(category.color))
    return category.color.toLowerCase();
  return (
    DEFAULT_BY_NAME[category.name] ??
    CATEGORY_COLORS[Math.abs(category.id - 1) % CATEGORY_COLORS.length].value
  );
}

/** Suggested color for a new category: the first palette color nobody uses yet. */
export function suggestColor(existing: ColoredCategory[]): string {
  const used = new Set(existing.map(categoryColor));
  return (
    CATEGORY_COLORS.find((c) => !used.has(c.value))?.value ??
    CATEGORY_COLORS[existing.length % CATEGORY_COLORS.length].value
  );
}
