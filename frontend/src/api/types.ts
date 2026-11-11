/**
 * API types matching the backend OpenAPI schemas (schema names in parentheses).
 * Money is integer VND, dates are "YYYY-MM-DD", months are "YYYY-MM".
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

// ---------- Auth
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
  /** Display name, 1–80 characters (trimmed by the backend). */
  display_name?: string;
  roast_enabled?: boolean;
  roast_tone?: Tone;
}

// ---------- Categories
/** (CategoryRead) */
export interface Category {
  id: number;
  name: string;
  kind: TxKind;
  icon: string;
  /** "#rrggbb" chosen by the user; "" lets the app pick from its palette (lib/categoryColor.ts). */
  color: string;
  /** Created on registration. */
  is_default: boolean;
}

/** (CategoryCreate) name 1–60 characters, icon up to 40. */
export type CategoryInput = Omit<Category, "id" | "is_default">;

// ---------- Transactions
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

// ---------- Budgets
/** (CategoryBudgetIn) limit 1 … 2.147.483.647 */
export interface BudgetCategoryInput {
  category_id: number;
  limit: number;
}

/** (BudgetUpdate) PUT replaces the whole budget of the month. */
export interface BudgetInput {
  month: string;
  total: number | null;
  categories: BudgetCategoryInput[];
}

/** (BudgetLine) One budget line; `category_id`/`name` null means the overall budget. */
export interface BudgetLine {
  category_id: number | null;
  name: string | null;
  limit: number;
  spent: number;
  usage_pct: number;
}

/** (BudgetStatus) `total` is null when no overall budget is set. */
export interface BudgetStatus {
  month: string;
  total: BudgetLine | null;
  categories: BudgetLine[];
}

// ---------- Dashboard
export interface CategoryAmount {
  category_id: number;
  name: string;
  amount: number;
}

export interface DailyAmount {
  date: string;
  income: number;
  expense: number;
  /** The day's expense split by category (largest first), for the stacked chart. */
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

// ---------- AI
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  question: string;
  history: ChatTurn[];
}

/** (ChatReply) Advisor answer. If the message was a spending statement, the backend logs it and returns the transaction. */
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

/** (RoastAlert) trigger/tone/provider are plain strings in the backend, so the UI must tolerate unknown values. */
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
  /** May be absent when no budget is set for the category. */
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
