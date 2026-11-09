/**
 * Icon danh mục luôn là emoji. Tài khoản tạo trước bản sửa này có icon dạng tên chữ
 * (backend cũ lưu "utensils", "car"…) nên đổi sang emoji tương ứng thay vì in nguyên chữ.
 */
const LEGACY_NAMES: Record<string, string> = {
  utensils: "🍜",
  car: "🛵",
  house: "🏠",
  receipt: "🧾",
  "shopping-bag": "🛍️",
  film: "🎮",
  heart: "💊",
  book: "📚",
  ellipsis: "📦",
  briefcase: "💼",
  gift: "🎁",
  plus: "💰",
};

export const DEFAULT_CATEGORY_ICON = "📦";

export function categoryIcon(icon: string | null | undefined): string {
  const value = (icon ?? "").trim();
  if (!value) return DEFAULT_CATEGORY_ICON;
  if (value in LEGACY_NAMES) return LEGACY_NAMES[value];
  // Chữ ASCII không phải emoji (tên icon lạ): dùng icon mặc định.
  if (/^[\x20-\x7e]+$/.test(value)) return DEFAULT_CATEGORY_ICON;
  return value;
}
