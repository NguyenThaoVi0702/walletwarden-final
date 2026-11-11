import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "../client";
import type {
  BudgetInput,
  BudgetStatus,
  Category,
  CategoryInput,
  ChatReply,
  ChatRequest,
  Dashboard,
  Health,
  LoginRequest,
  MonthlyReport,
  ParsedEntry,
  RegisterRequest,
  RoastAlert,
  TokenResponse,
  Transaction,
  TransactionCreated,
  TransactionInput,
  User,
  UserSettingsUpdate,
} from "../types";

export const queryKeys = {
  health: ["health"] as const,
  me: ["me"] as const,
  categories: ["categories"] as const,
  transactions: (month: string) => ["transactions", month] as const,
  budgets: (month: string) => ["budgets", month] as const,
  dashboard: (month: string) => ["dashboard", month] as const,
  alerts: ["ai", "alerts"] as const,
  report: (month: string) => ["ai", "report", month] as const,
};

// ---------- System
export const useHealth = () =>
  useQuery({
    queryKey: queryKeys.health,
    queryFn: () => request<Health>("GET", "/api/health"),
  });

// ---------- Auth
export const loginRequest = (body: LoginRequest) =>
  request<TokenResponse>("POST", "/api/auth/login", { body });

export const registerRequest = (body: RegisterRequest) =>
  request<TokenResponse>("POST", "/api/auth/register", { body });

export const fetchMe = () => request<User>("GET", "/api/me");

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UserSettingsUpdate) =>
      request<User>("PATCH", "/api/me/settings", { body }),
    onSuccess: (user) => qc.setQueryData(queryKeys.me, user),
  });
}

// ---------- Categories
export const useCategories = () =>
  useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => request<Category[]>("GET", "/api/categories"),
  });

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CategoryInput) =>
      request<Category>("POST", "/api/categories", { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.categories }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<CategoryInput> & { id: number }) =>
      request<Category>("PATCH", `/api/categories/${id}`, { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.categories }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      request<void>("DELETE", `/api/categories/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.categories }),
  });
}

// ---------- Transactions
export const useTransactions = (month: string) =>
  useQuery({
    queryKey: queryKeys.transactions(month),
    queryFn: () =>
      request<Transaction[]>("GET", "/api/transactions", { query: { month } }),
  });

/** After saving, the monthly figures (dashboard, budgets) change, so refresh them all. */
function invalidateMonthData(qc: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ["transactions"] }),
    qc.invalidateQueries({ queryKey: ["budgets"] }),
    qc.invalidateQueries({ queryKey: ["dashboard"] }),
  ]);
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TransactionInput) =>
      request<TransactionCreated>("POST", "/api/transactions", { body }),
    onSuccess: () => invalidateMonthData(qc),
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<TransactionInput> & { id: number }) =>
      request<Transaction>("PATCH", `/api/transactions/${id}`, { body }),
    onSuccess: () => invalidateMonthData(qc),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      request<void>("DELETE", `/api/transactions/${id}`),
    onSuccess: () => invalidateMonthData(qc),
  });
}

// ---------- Budgets
export const useBudgets = (month: string) =>
  useQuery({
    queryKey: queryKeys.budgets(month),
    queryFn: () =>
      request<BudgetStatus>("GET", "/api/budgets", { query: { month } }),
  });

export function useSaveBudgets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BudgetInput) =>
      request<BudgetStatus>("PUT", "/api/budgets", { body }),
    onSuccess: (data) => qc.setQueryData(queryKeys.budgets(data.month), data),
  });
}

// ---------- Dashboard
export const useDashboard = (month: string) =>
  useQuery({
    queryKey: queryKeys.dashboard(month),
    queryFn: () =>
      request<Dashboard>("GET", "/api/dashboard", { query: { month } }),
  });

// ---------- AI
export function useChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ChatRequest) =>
      request<ChatReply>("POST", "/api/ai/chat", {
        body: { ...body, history: body.history.slice(-6) },
      }),
    // A chat message that is a spending statement is logged by the backend: refresh the lists.
    onSuccess: (reply) => {
      if (reply.transaction) return invalidateMonthData(qc);
    },
  });
}

export const fetchUnreadAlerts = () =>
  request<RoastAlert[]>("GET", "/api/ai/alerts", { query: { unread: true } });

export const markAlertRead = (id: number) =>
  request<void>("POST", `/api/ai/alerts/${id}/read`);

export const reportAlert = (id: number) =>
  request<void>("POST", `/api/ai/alerts/${id}/report`);

export const useMonthlyReport = (month: string) =>
  useQuery({
    queryKey: queryKeys.report(month),
    queryFn: () =>
      request<MonthlyReport>("GET", "/api/ai/report", { query: { month } }),
    staleTime: 5 * 60_000,
  });

export const useParseEntry = () =>
  useMutation({
    mutationFn: (text: string) =>
      request<ParsedEntry>("POST", "/api/ai/parse", { body: { text } }),
  });
