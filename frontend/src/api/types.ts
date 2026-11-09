/**
 * Kiểu dữ liệu API theo contract trong INTEGRATION.md §1.2 và backend/app/ai/interface.py.
 *
 * TẠM THỜI viết tay, đã đối chiếu từng field với backend/openapi.json của PR #42 (Khải,
 * commit 3c994fb). Tên schema backend ghi trong ngoặc ở mỗi kiểu. Khi PR #42 merge vào develop:
 * `npm run gen:api` rồi thay từng kiểu ở đây bằng `components["schemas"]["..."]` từ ./schema
 * (giữ nguyên tên export để không phải sửa nơi dùng).
 *
 * Quy ước: tiền là số nguyên VND, ngày "YYYY-MM-DD", tháng "YYYY-MM".
 */

export type Tone = "gentle" | "honest" | "savage";
export type TxKind = "expense" | "income";
export type ProviderName = "local" | "gemini" | "rules" | "fake";

export type RoastTrigger =
  | "budget_80"
  | "budget_100"
  | "large_expense"
  | "daily_spike"
  | "repeat_today"
  | "small_habit"
  | "spending_streak"
  | "payday_splurge"
  | "over_income"
  | "burn_rate";

// ---------- F1: Auth / người dùng
export interface User {
  id: number;
  email: string;
  display_name: string;
  roast_enabled: boolean;
  roast_tone: Tone;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest extends LoginRequest {
  display_name: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: "bearer";
  user: User;
}

export interface UserSettingsUpdate {
  /** Tên hiển thị, 1–80 ký tự (backend tự cắt khoảng trắng hai đầu). */
  display_name?: string;
  roast_enabled?: boolean;
  roast_tone?: Tone;
}

// ---------- F3: Danh mục
/** (CategoryRead) */
export interface Category {
  id: number;
  name: string;
  kind: TxKind;
  icon: string;
  /** "#rrggbb" người dùng chọn; "" = app tự chọn từ bảng màu (lib/categoryColor.ts). */
  color: string;
  /** Danh mục tạo sẵn khi đăng ký (INTEGRATION.md §1.3). */
  is_default: boolean;
}

/** (CategoryCreate) name 1–60 ký tự, icon ≤ 40 ký tự. */
export type CategoryInput = Omit<Category, "id" | "is_default">;

// ---------- F2: Giao dịch
export interface Transaction {
  id: number;
  kind: TxKind;
  amount: number;
  category_id: number;
  date: string;
  note: string | null;
}

export type TransactionInput = Omit<Transaction, "id">;

export interface TransactionCreated {
  transaction: Transaction;
  roast_pending: boolean;
}

// ---------- F4: Ngân sách
/** (CategoryBudgetIn) limit 1 … 2.147.483.647 */
export interface BudgetCategoryInput {
  category_id: number;
  limit: number;
}

/** (BudgetUpdate) PUT thay toàn bộ ngân sách của tháng. */
export interface BudgetInput {
  month: string;
  total: number | null;
  categories: BudgetCategoryInput[];
}

/** (BudgetLine) Một dòng ngân sách; `category_id`/`name` = null nghĩa là ngân sách tổng. */
export interface BudgetLine {
  category_id: number | null;
  name: string | null;
  limit: number;
  spent: number;
  usage_pct: number;
}

/** (BudgetStatus) `total` = null khi chưa đặt ngân sách tổng. */
export interface BudgetStatus {
  month: string;
  total: BudgetLine | null;
  categories: BudgetLine[];
}

// ---------- F5: Dashboard
export interface CategoryAmount {
  category_id: number;
  name: string;
  amount: number;
}

export interface DailyAmount {
  date: string;
  income: number;
  expense: number;
  /** Khoản chi của ngày chia theo danh mục (lớn trước), cho biểu đồ cột chồng. */
  categories?: { category_id: number; amount: number }[];
}

export interface Dashboard {
  month: string;
  income: number;
  expense: number;
  balance: number;
  by_category: CategoryAmount[];
  daily: DailyAmount[];
}

// ---------- F6–F9: AI
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  question: string;
  history: ChatTurn[];
}

/** (ChatReply) Câu trả lời của trợ lý. Nếu tin nhắn là một khoản thu/chi ("nay ăn bánh cuốn
 * hết 50k"), backend tự ghi giao dịch và trả về ở `transaction`. */
export interface ChatReply extends AIReply {
  transaction?: Transaction | null;
  roast_pending?: boolean;
}

export interface AIReply {
  text: string;
  provider: ProviderName;
  fallback: boolean;
  latency_ms: number;
}

/** (RoastAlert) backend khai báo trigger/tone/provider là string nên UI phải chịu được giá trị lạ. */
export interface RoastAlert {
  id: number;
  created_at: string;
  trigger: RoastTrigger | (string & {});
  tone: Tone | (string & {});
  category: string | null;
  text: string;
  provider: ProviderName | (string & {});
  read: boolean;
}

export interface CategorySummary {
  name: string;
  spent: number;
  /** Có thể không có trong response (chưa đặt ngân sách cho danh mục). */
  budget?: number | null;
  usage_pct?: number | null;
}

export interface ExpenseItem {
  category: string;
  amount: number;
  day: string;
}

export interface MonthlyReport {
  month: string;
  headline: string;
  commentary: string;
  saving_tip: string;
  top_categories: CategorySummary[];
  biggest_expenses: ExpenseItem[];
  provider: ProviderName;
  fallback: boolean;
}

export interface ParsedEntry {
  kind: TxKind;
  amount: number;
  category: string;
  note: string;
  provider: ProviderName;
}

export interface Health {
  status: string;
  env: string;
  ai: Record<string, unknown>;
}
