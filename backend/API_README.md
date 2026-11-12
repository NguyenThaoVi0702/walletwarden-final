# WalletWarden API Reference

This guide documents the implemented HTTP API. The machine-readable contract is
[`openapi.json`](./openapi.json); interactive Swagger UI is available at
`http://localhost:8000/docs` while the backend is running.

## Base URL and conventions

```bash
export BASE_URL="http://localhost:8000"
```

- Every endpoint is below `/api`.
- Send and receive JSON unless an endpoint says otherwise.
- Except for `GET /api/health`, registration, and login, endpoints require a
  bearer access token: `Authorization: Bearer <access_token>`.
- Money amounts and limits are integer VND. Dates are `YYYY-MM-DD`; months are
  `YYYY-MM`.
- A successful delete or alert action returns `204 No Content` with an empty body.
- Common errors use FastAPI's format, for example `{"detail":"Transaction not found"}`.
  Invalid request data returns `422`; a resource not owned by the caller is
  generally reported as `404`.

In the examples, replace `<TOKEN>` with the `access_token` returned by register
or login. A convenient shell variable is:

```bash
export TOKEN="<access_token>"
```

## 1. System and authentication

### `GET /api/health`

Checks that the API is responding and includes AI provider health information.
This route does not require authentication.

**Parameters:** none.

```bash
curl "$BASE_URL/api/health"
```

Example response:

```json
{
  "status": "ok",
  "env": "dev",
  "ai": {
    "chain": ["fake"],
    "providers": {}
  }
}
```

### `POST /api/auth/register`

Creates an account, hashes the password, creates the default categories, and
returns a bearer token. No authentication required.

**JSON body**

| Field | Type | Constraints |
|---|---|---|
| `email` | string | Valid email; 3–320 characters. Normalized to lowercase. |
| `password` | string | 8–128 characters. |
| `display_name` | string | 1–80 characters; whitespace is trimmed. |

```bash
curl -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"alex@example.com","password":"correct-horse-42","display_name":"Alex"}'
```

Returns `201 Created`:

```json
{
  "access_token": "<JWT>",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "email": "alex@example.com",
    "display_name": "Alex",
    "roast_enabled": true,
    "roast_tone": "honest"
  }
}
```

An already registered email returns `409 Conflict`. Registration is limited to
10 requests per minute per client IP.

### `POST /api/auth/login`

Authenticates an existing user and returns a fresh bearer token. No
authentication required.

**JSON body**

| Field | Type | Constraints |
|---|---|---|
| `email` | string | 3–320 characters. |
| `password` | string | 1–128 characters. |

```bash
curl -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"alex@example.com","password":"correct-horse-42"}'
```

Returns the same shape as registration. Invalid credentials return `401`.
Login is limited to 10 requests per minute per client IP.

### `GET /api/me`

Returns the authenticated user's profile and Roast Mode settings.

**Parameters:** none.

```bash
curl "$BASE_URL/api/me" -H "Authorization: Bearer $TOKEN"
```

Response: `User` (`id`, `email`, `display_name`, `roast_enabled`, `roast_tone`).

### `PATCH /api/me/settings`

Updates only the supplied Roast Mode settings. Omitted values remain unchanged.

**JSON body**

| Field | Type | Allowed values |
|---|---|---|
| `roast_enabled` | boolean or null | `true` enables automatic roast alerts; `false` disables them. |
| `roast_tone` | string or null | `gentle`, `honest`, or `savage`. |

```bash
curl -X PATCH "$BASE_URL/api/me/settings" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"roast_enabled":false,"roast_tone":"gentle"}'
```

Returns the updated `User`.

## 2. Categories

Each account starts with 12 default categories: expense categories `Ăn uống`,
`Di chuyển`, `Nhà ở`, `Hóa đơn`, `Mua sắm`, `Giải trí`, `Sức khỏe`, `Giáo dục`,
`Khác`; and income categories `Lương`, `Thưởng`, `Thu nhập khác`.

`Category` response fields: `id`, `name`, `kind` (`expense` or `income`), `icon`,
and `is_default`.

### `GET /api/categories`

Lists the authenticated user's categories.

```bash
curl "$BASE_URL/api/categories" -H "Authorization: Bearer $TOKEN"
```

Returns `Category[]`.

### `POST /api/categories`

Creates a category for the current user.

**JSON body:** `name` (non-empty string, max 60 characters), `kind`
(`expense` or `income`), and optional `icon` (string, max 40 characters; defaults
to an empty string).

```bash
curl -X POST "$BASE_URL/api/categories" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Pets","kind":"expense","icon":"paw"}'
```

Returns `201 Created` with the created `Category`. A duplicate category name
within this account returns `409 Conflict`.

### `PATCH /api/categories/{category_id}`

Updates one or more category fields. A category can only be changed by its owner.

**Path parameter:** `category_id` (integer, required).

**JSON body:** any non-empty subset of `name`, `kind`, and `icon`. `name` must
remain non-empty and at most 60 characters; `kind` is `expense` or `income`;
`icon` is at most 40 characters.

```bash
curl -X PATCH "$BASE_URL/api/categories/13" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Pets & vet"}'
```

Returns the updated `Category`. A missing/other user's category returns `404`;
a duplicate name returns `409`.

### `DELETE /api/categories/{category_id}`

Deletes an owned category that is not referenced by any transaction or budget.

**Path parameter:** `category_id` (integer, required).

```bash
curl -X DELETE "$BASE_URL/api/categories/13" \
  -H "Authorization: Bearer $TOKEN"
```

Returns `204 No Content`. Returns `404` if the category is not owned by the user
and `409` if it is in use.

## 3. Transactions

`Transaction` response fields: `id`, `kind`, `amount`, `category_id`, `date`,
and nullable `note`. The category must belong to the caller, and its kind must
match the transaction kind.

### `GET /api/transactions`

Lists the authenticated user's transactions for a month, newest first.

**Query parameter:** `month` (optional `YYYY-MM`; defaults to the current month).

```bash
curl "$BASE_URL/api/transactions?month=2026-11" \
  -H "Authorization: Bearer $TOKEN"
```

Returns `Transaction[]`.

### `POST /api/transactions`

Creates and saves a transaction. If it is an expense and Roast Mode is enabled,
the backend checks the transaction history and budgets for a new roast trigger.
The roast text is generated and stored in the background.

**JSON body**

| Field | Type | Constraints |
|---|---|---|
| `kind` | string | `expense` or `income`; must match the category. |
| `amount` | integer | Greater than 0 and at most 2,147,483,647 VND. |
| `category_id` | integer | ID of an owned category. |
| `date` | string | Calendar date in `YYYY-MM-DD`. |
| `note` | string or null | Optional, max 500 characters. |

```bash
curl -X POST "$BASE_URL/api/transactions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"kind":"expense","amount":45000,"category_id":1,"date":"2026-11-06","note":"Milk tea"}'
```

Returns `201 Created`:

```json
{
  "transaction": {
    "id": 17,
    "kind": "expense",
    "amount": 45000,
    "category_id": 1,
    "date": "2026-11-06",
    "note": "Milk tea"
  },
  "roast_pending": false
}
```

`roast_pending` means a roast task was scheduled; the generated alert can be
retrieved from `GET /api/ai/alerts`.

### `PATCH /api/transactions/{transaction_id}`

Updates one or more fields on an owned transaction. `note` can be set to `null`
to clear it; other supplied fields cannot be null.

**Path parameter:** `transaction_id` (integer, required).

**JSON body:** any non-empty subset of `kind`, `amount`, `category_id`, `date`,
and `note`, with the same constraints as transaction creation.

```bash
curl -X PATCH "$BASE_URL/api/transactions/17" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount":50000,"note":null}'
```

Returns the updated `Transaction`. A missing/other user's transaction returns
`404`.

### `DELETE /api/transactions/{transaction_id}`

Deletes an owned transaction.

**Path parameter:** `transaction_id` (integer, required).

```bash
curl -X DELETE "$BASE_URL/api/transactions/17" \
  -H "Authorization: Bearer $TOKEN"
```

Returns `204 No Content`; returns `404` if the transaction is not owned by the user.

### `GET /api/transactions/export`

Downloads the user's transactions for one month as a CSV file. Text cells that
could be interpreted as spreadsheet formulas are escaped.

**Query parameter:** `month` (optional `YYYY-MM`; defaults to the current month).

```bash
curl "$BASE_URL/api/transactions/export?month=2026-11" \
  -H "Authorization: Bearer $TOKEN" \
  -o transactions-2026-11.csv
```

Returns `text/csv` with columns `date,kind,category,amount,note`.

## 4. Budgets and dashboard

### `GET /api/budgets`

Returns the configured total and category budgets for a month, along with
server-calculated spending and usage.

**Query parameter:** `month` (required `YYYY-MM`).

```bash
curl "$BASE_URL/api/budgets?month=2026-11" \
  -H "Authorization: Bearer $TOKEN"
```

Returns `BudgetStatus`:

```json
{
  "month": "2026-11",
  "total": {
    "category_id": null,
    "name": null,
    "limit": 6000000,
    "spent": 2100000,
    "usage_pct": 35
  },
  "categories": [
    {
      "category_id": 1,
      "name": "Ăn uống",
      "limit": 2500000,
      "spent": 800000,
      "usage_pct": 32
    }
  ]
}
```

`total` is `null` when no total budget exists. `categories` contains only
categories with configured budgets. Each line's `usage_pct` is rounded from
`spent / limit * 100`.

### `PUT /api/budgets`

Replaces all budget settings for the specified month. A missing or `null` `total`
means there is no total budget; omitted category budgets are removed. Only owned
expense categories can be budgeted.

**JSON body**

| Field | Type | Constraints |
|---|---|---|
| `month` | string | Required `YYYY-MM`. |
| `total` | integer or null | Optional, greater than 0; maximum 2,147,483,647 VND. |
| `categories` | array | Optional; at most 30 `{category_id, limit}` objects. |
| `categories[].category_id` | integer | ID of an owned expense category. |
| `categories[].limit` | integer | Greater than 0; maximum 2,147,483,647 VND. |

```bash
curl -X PUT "$BASE_URL/api/budgets" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"month":"2026-11","total":6000000,"categories":[{"category_id":1,"limit":2500000}]}'
```

Returns the calculated `BudgetStatus`. Duplicate category entries return `422`;
an invalid or non-owned category returns `404`.

### `GET /api/dashboard`

Returns income, expenses, balance, expense totals grouped by category, and daily
income/expense totals for a month.

**Query parameter:** `month` (optional `YYYY-MM`; defaults to the current month).

```bash
curl "$BASE_URL/api/dashboard?month=2026-11" \
  -H "Authorization: Bearer $TOKEN"
```

Response:

```json
{
  "month": "2026-11",
  "income": 8000000,
  "expense": 2100000,
  "balance": 5900000,
  "by_category": [{"category_id": 1, "name": "Ăn uống", "amount": 2100000}],
  "daily": [{"date": "2026-11-06", "income": 8000000, "expense": 2100000}]
}
```

## 5. AI and roast alerts

AI endpoints use the signed-in user's data. AI chat, monthly report, and quick
entry can return `429 Too Many Requests` with a `Retry-After` header when the
per-user AI rate limit is reached.

### `POST /api/ai/chat`

Asks the AI a question using the backend-computed current-month financial
summary and optional short conversation history.

**JSON body**

| Field | Type | Constraints |
|---|---|---|
| `question` | string | Required, 1–500 characters. |
| `history` | array | Optional, at most 6 chat turns. |
| `history[].role` | string | `user` or `assistant`. |
| `history[].content` | string | At most 2,000 characters. |

```bash
curl -X POST "$BASE_URL/api/ai/chat" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question":"How can I reduce my food spending?","history":[]}'
```

Returns `AIReply`: `text`, `provider` (`local`, `gemini`, `rules`, or `fake`),
`fallback`, and `latency_ms`.

### `GET /api/ai/alerts`

Lists the authenticated user's roast alerts, newest first.

**Query parameter:** `unread` (optional boolean; defaults to `false`). Set to
`true` to return only unread alerts.

```bash
curl "$BASE_URL/api/ai/alerts?unread=true" \
  -H "Authorization: Bearer $TOKEN"
```

Returns `RoastAlert[]`. Each alert has `id`, `created_at`, `trigger`, `tone`,
nullable `category`, `text`, `provider`, and `read`.

### `POST /api/ai/alerts/{alert_id}/read`

Marks an owned roast alert as read.

**Path parameter:** `alert_id` (integer, required).

```bash
curl -X POST "$BASE_URL/api/ai/alerts/3/read" \
  -H "Authorization: Bearer $TOKEN"
```

Returns `204 No Content`; a missing or other user's alert returns `404`.

### `POST /api/ai/alerts/{alert_id}/report`

Reports an owned roast alert for review.

**Path parameter:** `alert_id` (integer, required).

```bash
curl -X POST "$BASE_URL/api/ai/alerts/3/report" \
  -H "Authorization: Bearer $TOKEN"
```

Returns `204 No Content`; a missing or other user's alert returns `404`.

### `GET /api/ai/report`

Generates an AI-written monthly report from values calculated by the backend.

**Query parameter:** `month` (required `YYYY-MM`).

```bash
curl "$BASE_URL/api/ai/report?month=2026-11" \
  -H "Authorization: Bearer $TOKEN"
```

Returns `MonthlyReport`: `month`, `headline`, `commentary`, `saving_tip`,
`top_categories`, `biggest_expenses`, `provider`, and `fallback`.

### `POST /api/ai/parse`

Parses a quick-entry sentence into a structured transaction suggestion. This
endpoint does not save a transaction; submit the returned fields separately to
`POST /api/transactions`.

**JSON body:** `text` (required, 1–200 characters).

```bash
curl -X POST "$BASE_URL/api/ai/parse" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"trà sữa 45k"}'
```

Returns `ParsedEntry`: `kind`, `amount` (integer VND parsed by the backend),
`category`, `note`, and `provider`. If an amount cannot be identified, returns
`422 Unprocessable Entity`.

## Related documentation

- [`README.md`](./README.md): backend setup, ownership, architecture, and test commands.
