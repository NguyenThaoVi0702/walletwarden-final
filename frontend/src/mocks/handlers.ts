/**
 * MSW handlers for every API endpoint. Data is kept in memory (lost on reload);
 * tests call `resetMockDb()` before each case. Response shapes and error `detail`
 * messages mimic the real backend.
 *
 * Sample account: demo@walletwarden.vn / matkhau123
 */
import { delay, http, HttpResponse, type JsonBodyType } from "msw";
import type {
  ChatReply,
  BudgetInput,
  BudgetStatus,
  Category,
  CategoryInput,
  ChatRequest,
  Dashboard,
  LoginRequest,
  MonthlyReport,
  ParsedEntry,
  RegisterRequest,
  RoastAlert,
  RoastTrigger,
  Tone,
  TokenResponse,
  Transaction,
  TransactionCreated,
  TransactionInput,
  User,
  UserSettingsUpdate,
} from "../api/types";
import { currentMonth, parseMoney } from "../lib/format";
import {
  type MockAccount,
  seedAccounts,
  seedBudget,
  seedCategories,
  seedTransactions,
} from "./data";

const AI_DELAY_MS = import.meta.env.MODE === "test" ? 0 : 1200;
const CHAT_LIMIT_PER_MINUTE = 10;

interface MockDb {
  accounts: MockAccount[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Map<string, BudgetInput>;
  alerts: RoastAlert[];
  chatTimestamps: number[];
  nextId: number;
}

function freshDb(): MockDb {
  const month = currentMonth();
  return {
    accounts: seedAccounts(),
    categories: seedCategories(),
    transactions: seedTransactions(month),
    budgets: new Map([[month, seedBudget(month)]]),
    alerts: [],
    chatTimestamps: [],
    nextId: 1000,
  };
}

let db = freshDb();
export function resetMockDb() {
  db = freshDb();
}

// ---------- helpers
const detail = (status: number, message: string, init?: ResponseInit) =>
  HttpResponse.json({ detail: message }, { status, ...init });

const json = <T extends JsonBodyType>(data: T, status = 200) =>
  HttpResponse.json(data, { status });

const tokenFor = (user: User) => `mock-token-${user.id}`;

/** The signed-in account, or null if the Bearer token is missing or wrong. */
function currentAccount(request: Request): MockAccount | null {
  const header = request.headers.get("Authorization") ?? "";
  const id = Number(header.replace(/^Bearer mock-token-/, ""));
  return db.accounts.find((a) => a.user.id === id) ?? null;
}

const unauthorized = () => detail(401, "Could not validate credentials");

const monthOf = (request: Request) =>
  new URL(request.url).searchParams.get("month") ?? currentMonth();

const categoryName = (id: number) =>
  db.categories.find((c) => c.id === id)?.name ?? "Khác";

const sumBy = (items: Transaction[], pred: (t: Transaction) => boolean) =>
  items.filter(pred).reduce((s, t) => s + t.amount, 0);

const pct = (spent: number, limit: number) =>
  limit > 0 ? Math.round((spent / limit) * 100) : 0;

function budgetStatus(month: string): BudgetStatus {
  const budget = db.budgets.get(month) ?? {
    month,
    total: null,
    categories: [],
  };
  const txs = db.transactions.filter(
    (t) => t.date.startsWith(month) && t.kind === "expense",
  );
  const spent = sumBy(txs, () => true);
  return {
    month,
    total: budget.total
      ? {
          category_id: null,
          name: null,
          limit: budget.total,
          spent,
          usage_pct: pct(spent, budget.total),
        }
      : null,
    categories: budget.categories.map((c) => {
      const catSpent = sumBy(txs, (t) => t.category_id === c.category_id);
      return {
        category_id: c.category_id,
        name: categoryName(c.category_id),
        limit: c.limit,
        spent: catSpent,
        usage_pct: pct(catSpent, c.limit),
      };
    }),
  };
}

function dashboard(month: string): Dashboard {
  const txs = db.transactions.filter((t) => t.date.startsWith(month));
  const income = sumBy(txs, (t) => t.kind === "income");
  const expense = sumBy(txs, (t) => t.kind === "expense");

  const byCat = new Map<number, number>();
  const byDay = new Map<
    string,
    { income: number; expense: number; cats: Map<number, number> }
  >();
  for (const t of txs) {
    const d = byDay.get(t.date) ?? { income: 0, expense: 0, cats: new Map() };
    d[t.kind] += t.amount;
    if (t.kind === "expense") {
      byCat.set(t.category_id, (byCat.get(t.category_id) ?? 0) + t.amount);
      d.cats.set(t.category_id, (d.cats.get(t.category_id) ?? 0) + t.amount);
    }
    byDay.set(t.date, d);
  }

  return {
    month,
    income,
    expense,
    balance: income - expense,
    by_category: [...byCat]
      .map(([category_id, amount]) => ({
        category_id,
        name: categoryName(category_id),
        amount,
      }))
      .sort((a, b) => b.amount - a.amount),
    daily: [...byDay]
      .map(([date, { cats, ...v }]) => ({
        date,
        ...v,
        categories: [...cats]
          .map(([category_id, amount]) => ({ category_id, amount }))
          .sort((a, b) => b.amount - a.amount),
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}

/** Sample roast text for the saved transaction (the real AI runs in the backend). */
function roastText(
  trigger: RoastTrigger,
  tone: Tone,
  category: string,
  amount: number,
  pct?: number,
): string {
  const money = `${amount.toLocaleString("vi-VN")} ₫`;
  if (trigger !== "large_expense") {
    return {
      gentle: `Ngân sách ${category} đã dùng ${pct}% rồi đó. Mấy ngày tới mình chậm lại một chút nha 🌱`,
      honest: `${category} đã tiêu ${pct}% ngân sách tháng. Nói thật: cứ đà này là hết trước cuối tháng.`,
      savage: `${pct}% ngân sách ${category} bay màu. Ví bạn đang gửi đơn xin nghỉ việc.`,
    }[tone];
  }
  return {
    gentle: `Vừa chi ${money} cho ${category}. Nhớ chừa lại một chút cho cuối tháng nha 🌱`,
    honest: `${money} cho ${category} trong một lần, cao hơn hẳn mức chi thường ngày của bạn.`,
    savage: `${money} cho ${category}? Ví bạn vừa thở dài một tiếng rất to.`,
  }[tone];
}

/** Simulated roast trigger: a large expense or a category over 80% of its budget. */
function maybeRoast(account: MockAccount, tx: Transaction): boolean {
  if (!account.user.roast_enabled || tx.kind !== "expense") return false;
  const status = budgetStatus(tx.date.slice(0, 7));
  const cat = status.categories.find((c) => c.category_id === tx.category_id);
  if (tx.amount < 200_000 && (!cat || cat.usage_pct < 80)) return false;

  const name = categoryName(tx.category_id);
  const trigger =
    cat && cat.usage_pct >= 80
      ? cat.usage_pct >= 100
        ? "budget_100"
        : "budget_80"
      : "large_expense";
  db.alerts.push({
    trigger,
    text: roastText(
      trigger,
      account.user.roast_tone,
      name,
      tx.amount,
      cat?.usage_pct,
    ),
    provider: "fake",
    id: db.nextId++,
    created_at: new Date().toISOString(),
    tone: account.user.roast_tone,
    category: categoryName(tx.category_id),
    read: false,
  });
  return true;
}

function toTransaction(
  body: Partial<TransactionInput>,
): TransactionInput | string {
  if (body.kind !== "expense" && body.kind !== "income")
    return "kind phải là expense hoặc income";
  if (!Number.isInteger(body.amount) || (body.amount ?? 0) <= 0)
    return "amount phải là số nguyên > 0";
  const category = db.categories.find((c) => c.id === body.category_id);
  if (!category) return "Category not found";
  if (category.kind !== body.kind)
    return "Transaction kind must match category kind";
  if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date))
    return "date phải có dạng YYYY-MM-DD";
  return {
    kind: body.kind,
    amount: body.amount!,
    category_id: body.category_id!,
    date: body.date,
    note: body.note ?? null,
  };
}

// ---------- handlers
export const handlers = [
  http.get("/api/health", () =>
    json({ status: "ok", env: "mock", ai: { providers: { fake: true } } }),
  ),

  // Auth
  http.post("/api/auth/login", async ({ request }) => {
    await delay();
    const body = (await request.json()) as LoginRequest;
    const account = db.accounts.find(
      (a) =>
        a.user.email.toLowerCase() === body.email?.toLowerCase() &&
        a.password === body.password,
    );
    if (!account) return detail(401, "Invalid email or password");
    return json<TokenResponse>({
      access_token: tokenFor(account.user),
      token_type: "bearer",
      user: account.user,
    });
  }),

  http.post("/api/auth/register", async ({ request }) => {
    await delay();
    const body = (await request.json()) as RegisterRequest;
    if (
      db.accounts.some(
        (a) => a.user.email.toLowerCase() === body.email?.toLowerCase(),
      )
    ) {
      return detail(409, "Email already registered");
    }
    const user: User = {
      id: db.nextId++,
      email: body.email,
      display_name: body.display_name,
      roast_enabled: false,
      roast_tone: "gentle",
    };
    db.accounts.push({ user, password: body.password });
    return json<TokenResponse>(
      { access_token: tokenFor(user), token_type: "bearer", user },
      201,
    );
  }),

  http.get("/api/me", ({ request }) => {
    const account = currentAccount(request);
    return account ? json(account.user) : unauthorized();
  }),

  http.patch("/api/me/settings", async ({ request }) => {
    const account = currentAccount(request);
    if (!account) return unauthorized();
    const body = (await request.json()) as UserSettingsUpdate;
    if (body.display_name !== undefined) {
      body.display_name = body.display_name.trim();
      if (!body.display_name || body.display_name.length > 80)
        return json({ detail: "Display name cannot be empty" }, 422);
    }
    account.user = { ...account.user, ...body };
    return json(account.user);
  }),

  // Categories
  http.get("/api/categories", ({ request }) => {
    if (!currentAccount(request)) return unauthorized();
    return json(db.categories);
  }),

  http.post("/api/categories", async ({ request }) => {
    if (!currentAccount(request)) return unauthorized();
    const body = (await request.json()) as CategoryInput;
    if (!body.name?.trim()) return detail(422, "Category name cannot be empty");
    if (
      db.categories.some((c) => c.name === body.name && c.kind === body.kind)
    ) {
      return detail(409, "Category name already exists");
    }
    const category: Category = { ...body, id: db.nextId++, is_default: false };
    db.categories.push(category);
    return json(category, 201);
  }),

  http.patch("/api/categories/:id", async ({ request, params }) => {
    if (!currentAccount(request)) return unauthorized();
    const category = db.categories.find((c) => c.id === Number(params.id));
    if (!category) return detail(404, "Category not found");
    const patch = (await request.json()) as Partial<CategoryInput>;
    const kind = patch.kind ?? category.kind;
    if (
      patch.name &&
      db.categories.some(
        (c) => c.id !== category.id && c.name === patch.name && c.kind === kind,
      )
    ) {
      return detail(409, "Category name already exists");
    }
    Object.assign(category, patch);
    return json(category);
  }),

  http.delete("/api/categories/:id", ({ request, params }) => {
    if (!currentAccount(request)) return unauthorized();
    const id = Number(params.id);
    const inBudget = [...db.budgets.values()].some((b) =>
      b.categories.some((c) => c.category_id === id),
    );
    if (db.transactions.some((t) => t.category_id === id) || inBudget) {
      return detail(409, "Category is in use");
    }
    db.categories = db.categories.filter((c) => c.id !== id);
    return new HttpResponse(null, { status: 204 });
  }),

  // Transactions (CSV export before :id)
  http.get("/api/transactions/export", ({ request }) => {
    if (!currentAccount(request)) return unauthorized();
    const month = monthOf(request);
    const rows = db.transactions
      .filter((t) => t.date.startsWith(month))
      .map((t) =>
        [
          t.date,
          t.kind,
          t.amount,
          categoryName(t.category_id),
          `"${t.note ?? ""}"`,
        ].join(","),
      );
    return new HttpResponse(
      ["date,kind,amount,category,note", ...rows].join("\n"),
      {
        headers: { "Content-Type": "text/csv; charset=utf-8" },
      },
    );
  }),

  http.get("/api/transactions", async ({ request }) => {
    if (!currentAccount(request)) return unauthorized();
    await delay();
    const month = monthOf(request);
    return json(
      db.transactions
        .filter((t) => t.date.startsWith(month))
        .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id),
    );
  }),

  http.post("/api/transactions", async ({ request }) => {
    const account = currentAccount(request);
    if (!account) return unauthorized();
    const parsed = toTransaction(
      (await request.json()) as Partial<TransactionInput>,
    );
    if (typeof parsed === "string") return detail(422, parsed);
    const transaction: Transaction = { ...parsed, id: db.nextId++ };
    db.transactions.push(transaction);
    return json<TransactionCreated>(
      { transaction, roast_pending: maybeRoast(account, transaction) },
      201,
    );
  }),

  http.patch("/api/transactions/:id", async ({ request, params }) => {
    if (!currentAccount(request)) return unauthorized();
    const tx = db.transactions.find((t) => t.id === Number(params.id));
    if (!tx) return detail(404, "Transaction not found");
    const parsed = toTransaction({
      ...tx,
      ...((await request.json()) as Partial<TransactionInput>),
    });
    if (typeof parsed === "string") return detail(422, parsed);
    Object.assign(tx, parsed);
    return json(tx);
  }),

  http.delete("/api/transactions/:id", ({ request, params }) => {
    if (!currentAccount(request)) return unauthorized();
    db.transactions = db.transactions.filter((t) => t.id !== Number(params.id));
    return new HttpResponse(null, { status: 204 });
  }),

  // Budgets
  http.get("/api/budgets", ({ request }) => {
    if (!currentAccount(request)) return unauthorized();
    return json(budgetStatus(monthOf(request)));
  }),

  http.put("/api/budgets", async ({ request }) => {
    if (!currentAccount(request)) return unauthorized();
    const body = (await request.json()) as BudgetInput;
    const ids = body.categories.map((c) => c.category_id);
    if (new Set(ids).size !== ids.length)
      return detail(422, "Duplicate category budget");
    db.budgets.set(body.month, body);
    return json(budgetStatus(body.month));
  }),

  // Dashboard
  http.get("/api/dashboard", async ({ request }) => {
    if (!currentAccount(request)) return unauthorized();
    await delay();
    return json(dashboard(monthOf(request)));
  }),

  // AI chat (limit 10 per minute → 429 + Retry-After)
  http.post("/api/ai/chat", async ({ request }) => {
    if (!currentAccount(request)) return unauthorized();
    const now = Date.now();
    db.chatTimestamps = db.chatTimestamps.filter((t) => now - t < 60_000);
    if (db.chatTimestamps.length >= CHAT_LIMIT_PER_MINUTE) {
      const retry = Math.ceil((60_000 - (now - db.chatTimestamps[0])) / 1000);
      return detail(429, "Bạn hỏi hơi nhanh, thử lại sau ít giây", {
        headers: { "Retry-After": String(retry) },
      });
    }
    db.chatTimestamps.push(now);

    const body = (await request.json()) as ChatRequest;
    await delay(AI_DELAY_MS);
    const d = dashboard(currentMonth());
    const top = d.by_category[0];
    return json<ChatReply>({
      transaction: null,
      roast_pending: false,
      text:
        `(Trả lời mẫu) Bạn hỏi: "${body.question}". Tháng này bạn đã chi ${d.expense.toLocaleString("vi-VN")} ₫` +
        (top ? `, nhiều nhất cho ${top.name}.` : ".") +
        " Thử đặt hạn mức cho danh mục đó và theo dõi mỗi tuần nhé.",
      provider: "fake",
      fallback: false,
      latency_ms: AI_DELAY_MS,
    });
  }),

  // Roast alerts
  http.get("/api/ai/alerts", ({ request }) => {
    if (!currentAccount(request)) return unauthorized();
    const unread = new URL(request.url).searchParams.get("unread") === "true";
    return json(db.alerts.filter((a) => !unread || !a.read));
  }),

  http.post("/api/ai/alerts/:id/read", ({ request, params }) => {
    if (!currentAccount(request)) return unauthorized();
    const alert = db.alerts.find((a) => a.id === Number(params.id));
    if (alert) alert.read = true;
    return new HttpResponse(null, { status: 204 });
  }),

  http.post("/api/ai/alerts/:id/report", ({ request }) => {
    if (!currentAccount(request)) return unauthorized();
    return new HttpResponse(null, { status: 204 });
  }),

  // Monthly report
  http.get("/api/ai/report", async ({ request }) => {
    if (!currentAccount(request)) return unauthorized();
    const month = monthOf(request);
    await delay(AI_DELAY_MS);
    const status = budgetStatus(month);
    const d = dashboard(month);
    return json<MonthlyReport>({
      month,
      headline:
        d.balance >= 0
          ? "Tháng này bạn vẫn còn dư, giữ phong độ nhé!"
          : "Tháng này chi vượt thu rồi.",
      commentary: `Thu ${d.income.toLocaleString("vi-VN")} ₫, chi ${d.expense.toLocaleString("vi-VN")} ₫.`,
      saving_tip:
        "Gom các khoản nhỏ như trà sữa, cà phê lại: mỗi tuần bớt 2 ly là tiết kiệm ~360.000 ₫/tháng.",
      top_categories: d.by_category.slice(0, 3).map((c) => {
        const b = status.categories.find(
          (x) => x.category_id === c.category_id,
        );
        return {
          name: c.name,
          spent: c.amount,
          budget: b?.limit ?? null,
          usage_pct: b?.usage_pct ?? null,
        };
      }),
      biggest_expenses: db.transactions
        .filter((t) => t.date.startsWith(month) && t.kind === "expense")
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5)
        .map((t) => ({
          category: categoryName(t.category_id),
          amount: t.amount,
          day: t.date,
        })),
      provider: "fake",
      fallback: false,
    });
  }),

  // Quick entry
  http.post("/api/ai/parse", async ({ request }) => {
    if (!currentAccount(request)) return unauthorized();
    const { text } = (await request.json()) as { text: string };
    const words = text.trim().split(/\s+/);
    const amountIdx = words.findIndex((w) => parseMoney(w) !== null);
    if (amountIdx < 0)
      return detail(422, "Could not find an amount in the entry");
    const note = words.filter((_, i) => i !== amountIdx).join(" ");
    const isIncome = /lương|thưởng|nhận/i.test(note);
    return json<ParsedEntry>({
      kind: isIncome ? "income" : "expense",
      amount: parseMoney(words[amountIdx])!,
      category: isIncome
        ? "Thu nhập khác"
        : /trà|cơm|phở|bún|cà phê|ăn/i.test(note)
          ? "Ăn uống"
          : "Khác",
      note,
      provider: "fake",
    });
  }),
];
