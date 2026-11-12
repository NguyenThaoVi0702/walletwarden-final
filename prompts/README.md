# Prompts

Each AI feature uses exactly one Jinja2 template. They are rendered by [backend/app/ai/prompts.py](../backend/app/ai/prompts.py). Prompts are in Vietnamese because the app is.

| File | Feature | Variables |
|---|---|---|
| `advisor_system.j2` | chat advisor | – |
| `summary.j2` | month figures for the advisor and report | `s`: `FinancialSummary` |
| `roast_system.j2` | roast rules and tone | `tone`: `gentle`, `honest` or `savage` |
| `roast_user.j2` | the event to roast | `c`: `RoastContext`, `f`: derived figures |
| `report_system.j2` | monthly report (JSON) | – |
| `quick_entry_system.j2` | quick entry (JSON) | `categories`: category names |
| `roast_examples.yaml` | few-shot examples by tone | – |
| `testset/cases.yaml` | 44-case test set | – |
| `testset/results/` | output of each test-set run | – |

Template filters: `{{ x | vnd }}` gives `1.500.000đ`, `{{ x | pct }}` gives `82%`.

## Editing

- Keep arithmetic out of prompts. Compute new figures in code (`roast_facts()` or the summary service) and pass them in.
- After a change, run `uv run pytest tests/ai` and the test set (see [backend/app/ai/README.md](../backend/app/ai/README.md)).
