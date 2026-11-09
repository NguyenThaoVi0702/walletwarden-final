/**
 * Màu danh mục. Người dùng chọn màu cho từng danh mục; mọi biểu đồ có danh mục dùng đúng màu đó.
 *
 * 8 màu dưới đây là bảng màu phân loại đã kiểm tra (dataviz validator, nền trắng): đủ khác nhau
 * với người mù màu và theo đúng thứ tự này. Màu xám dành cho "Khác"/"Còn lại".
 * Backend (services/defaults.py) gán sẵn các màu này cho danh mục mặc định.
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

/** Tài khoản tạo trước khi có màu: danh mục mặc định lấy màu như backend gán. */
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

/** Màu gợi ý cho danh mục mới: màu đầu tiên trong bảng chưa ai dùng. */
export function suggestColor(existing: ColoredCategory[]): string {
  const used = new Set(existing.map(categoryColor));
  return (
    CATEGORY_COLORS.find((c) => !used.has(c.value))?.value ??
    CATEGORY_COLORS[existing.length % CATEGORY_COLORS.length].value
  );
}
