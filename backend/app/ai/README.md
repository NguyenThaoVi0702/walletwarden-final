# AI module

Everything the app needs from a language model: chat advice, roast messages, the monthly report and quick entry from text. Import from `app.ai` (or `app.ai.interface` for types) only.

```
app/ai/
  interface.py     public contract: Pydantic models and the AIService protocol
  __init__.py      get_ai_service() FastAPI dependency
  service.py       provider router: try each provider, check output, fall back to rules
  providers/       llamacpp.py (local llama-server), gemini.py (Gemini API)
  rules.py         rule-based answers: last fallback and the "fake" provider
  triggers.py      decides if a new transaction deserves a roast, and which one
  entry.py         tells a spending statement from a question in the chat
  guard.py         output checks: empty, too long, banned words, invented numbers
  prompts.py       renders the Jinja2 templates in /prompts
  formatting.py    VND formatting and amount parsing ("1tr2", "5 xị")
  ratelimit.py     per-user request limit
  calllog.py       one JSON line per AI call (task, provider, latency; never prompt text)
```

## How a request is answered

1. Rate limit the user (roasts are exempt, they are triggered by saving a transaction).
2. Build the prompt. All numbers are computed in code and pre-formatted; the model never does arithmetic.
3. Try each provider in `WW_AI_PROVIDERS` order. A timeout, error or rejected output moves on to the next one.
4. If none succeeds, the rule engine answers (`fallback=true`).

| `WW_AI_PROVIDERS` | When to use |
|---|---|
| `fake` (default) | development, tests, machines without a GPU |
| `local` | local model only |
| `local,gemini` | local model, Gemini as backup |
| `gemini` | no GPU, with an API key |

## Roast triggers

`detect_roast` is a pure function: it takes the new transaction, 35 days of history and the budgets, and returns at most one roast, in this priority order:

1. `over_income` – this month's spending passed this month's income
2. `budget_100` – a budget was just exceeded
3. `payday_splurge` – a large share of the salary is gone within days
4. `budget_80` – a budget reached 80%
5. `daily_spike` – today is much higher than yesterday
6. `large_expense` – one expense far above the average
7. `repeat_today` – third purchase in a category today
8. `small_habit` – many small purchases adding up
9. `spending_streak` – the same fun category several days in a row
10. `burn_rate` – at this pace the budget ends well before month end

Thresholds are constants at the top of [triggers.py](triggers.py). Rent, bills, tuition and health are never roasted for habits or spikes, only for budget overruns.

## Money slang

[formatting.py](formatting.py) reads Vietnamese amounts: `45k`, `1tr2`, `1 củ rưỡi`, `5 xị`. A standard amount in the text always wins over slang, because words like "chai" and "lít" are also counting words ("2 chai bia 50k").

## Safety

- Prompts forbid comments about appearance, identity or family, and the guard rejects banned words.
- Roasts are at most three sentences and end with a practical suggestion.
- Roast mode is opt-in per user.
- Prompts contain aggregated numbers and category names only.

## Commands

```powershell
cd backend
uv run pytest tests/ai -q                                      # unit tests, no GPU needed
uv run python ../scripts/run_ai_testset.py                     # 44-case test set, simulated AI
uv run python ../scripts/run_ai_testset.py --providers local   # against the local model
uv run python ../llm/bench.py --concurrency 1 4 5              # llama-server speed
uv run python ../scripts/ai_metrics.py                         # latency and fallback rate from the log
```

### Playground

A small page for trying the module by hand (development only, not part of the app):

```powershell
$env:WW_AI_PROVIDERS="local"          # or "fake"
uv run uvicorn app.ai.playground:app --port 8001
```

Open <http://127.0.0.1:8001>.

## Changing a prompt

1. Edit the template in [prompts/](../../../prompts/README.md).
2. Run `uv run pytest tests/ai`; it renders every prompt and fails on missing variables.
3. Run the 44-case test set against the local model and review the result file in `prompts/testset/results/`.
