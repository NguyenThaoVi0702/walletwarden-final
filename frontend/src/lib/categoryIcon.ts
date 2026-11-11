/**
 * Category icons are emoji. Older accounts stored names such as "utensils" or "car";
 * those are mapped to the matching emoji.
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
  // ASCII text that is not an emoji (unknown icon name): use the default icon.
  if (/^[\x20-\x7e]+$/.test(value)) return DEFAULT_CATEGORY_ICON;
  return value;
}
