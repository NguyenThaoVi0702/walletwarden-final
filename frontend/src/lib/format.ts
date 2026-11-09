const vnd = new Intl.NumberFormat("vi-VN");

/** Số tiền lớn nhất backend nhận (int32, Field(le=2_147_483_647)). */
export const MAX_VND = 2_147_483_647;

/** formatVND(1500000) → "1.500.000 ₫" */
export function formatVND(amount: number): string {
  return `${vnd.format(Math.round(amount))} ₫`;
}

/** Số tiền để điền sẵn vào ô nhập: 9000000 → "9.000.000" (parseMoney đọc lại được). */
export function formatAmountInput(amount: number): string {
  return vnd.format(Math.round(amount));
}

/**
 * Đọc số tiền người dùng gõ, trả về số nguyên VND hoặc null nếu không hiểu.
 * Hỗ trợ: "1500000", "1.500.000", "45k", "45 nghìn", "1tr", "1tr2", "1,5tr", "2 triệu".
 */
export function parseMoney(input: string): number | null {
  const s = input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/₫|đ|vnd$/g, "");
  if (!s) return null;

  // 1tr2 → 1.200.000, 1tr → 1.000.000, 1,5tr → 1.500.000
  let m = s.match(/^(\d+(?:[.,]\d+)?)(?:tr|triệu|trieu|m)(\d{0,3})$/);
  if (m) {
    const base = Number(m[1].replace(",", ".")) * 1_000_000;
    const tail = m[2] ? Number(m[2].padEnd(3, "0")) * 1_000 : 0;
    return Math.round(base + tail);
  }

  // 45k, 45 nghìn, 1,5k
  m = s.match(/^(\d+(?:[.,]\d+)?)(?:k|nghìn|nghin|ngàn|ngan)$/);
  if (m) return Math.round(Number(m[1].replace(",", ".")) * 1_000);

  // 1.500.000 hoặc 1,500,000 hoặc 1500000
  if (/^\d{1,3}([.,]\d{3})+$/.test(s) || /^\d+$/.test(s)) {
    return Number(s.replace(/[.,]/g, ""));
  }
  return null;
}

/** Tháng hiện tại dạng "YYYY-MM" theo giờ máy. */
export function currentMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** "2026-11" → "Tháng 11/2026" */
export function formatMonth(month: string): string {
  const [y, m] = month.split("-");
  return `Tháng ${Number(m)}/${y}`;
}

/** shiftMonth("2026-01", -1) → "2025-12" */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  return currentMonth(new Date(y, m - 1 + delta, 1));
}

/** Ngày hôm nay dạng "YYYY-MM-DD" theo giờ máy. */
export function todayISO(now: Date = new Date()): string {
  return `${currentMonth(now)}-${String(now.getDate()).padStart(2, "0")}`;
}

/** "2026-11-05" → "05/11/2026" */
export function formatDate(iso: string): string {
  return iso.split("-").reverse().join("/");
}

/** "2026-11-05" → "Thứ năm, 05/11" */
export function formatDayHeading(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const weekday = new Date(y, m - 1, d).getDay();
  const name =
    weekday === 0
      ? "Chủ nhật"
      : `Thứ ${["", "hai", "ba", "tư", "năm", "sáu", "bảy"][weekday]}`;
  return `${name}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

/** Rút gọn số tiền cho trục biểu đồ: 1500000 → "1,5tr", 45000 → "45k" */
export function formatCompactVND(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000)
    return `${(amount / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}tr`;
  if (abs >= 1_000) return `${Math.round(amount / 1_000)}k`;
  return String(amount);
}
