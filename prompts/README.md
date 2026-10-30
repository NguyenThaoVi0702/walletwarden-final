# Prompts (chủ: Vi)

Mỗi tính năng AI = đúng một prompt, viết bằng Jinja2. Code render chúng ở [backend/app/ai/prompts.py](../backend/app/ai/prompts.py).

| File | Tính năng | Biến nhận vào |
|---|---|---|
| `advisor_system.j2` | F6 cố vấn | – |
| `summary.j2` | F6, F8: số liệu tháng | `s`: `FinancialSummary` |
| `roast_system.j2` | F7 roast, quy tắc + giọng | `tone`: `gentle` \| `honest` \| `savage` |
| `roast_user.j2` | F7 sự kiện | `c`: `RoastContext`, `f`: số phụ (`remaining`, `daily_allowance`, `times_average`) |
| `report_system.j2` | F8 báo cáo tháng (JSON) | – |
| `quick_entry_system.j2` | F9 nhập nhanh (JSON) | `categories`: list tên danh mục |
| `testset/cases.yaml` | bộ 30 case | – |
| `testset/results/` | kết quả mỗi lần chạy, có cột chấm điểm | – |

Filter dùng được trong template: `{{ x | vnd }}` → `1.500.000đ`, `{{ x | pct }}` → `82%`.

Quy tắc khi sửa:

- Không đưa phép tính vào prompt. Cần số mới thì thêm vào `roast_facts()` hoặc nhờ Khải thêm vào `FinancialSummary`.
- Sửa xong **luôn** chạy lại bộ 30 case (xem [backend/app/ai/README.md §4](../backend/app/ai/README.md)).
- Prompt là tiếng Việt vì app dùng tiếng Việt.
