# Module AI: hướng dẫn cho Vi

> Chủ: **Vi** (PM, AI Engineer, Architect) · Người review PR của bạn: **Khải** · Bạn review PR của: **Tùng**

Bạn sở hữu: `backend/app/ai/`, `backend/tests/ai/`, `prompts/`, `llm/`, `scripts/`.

## 1. Trạng thái (30/10)

| Task | Trạng thái | Ở đâu |
|---|---|---|
| T11 Interface + fake provider + prompt spec | **xong**, cần cả nhóm duyệt ở M1 | `interface.py`, `rules.py` (= fake), `prompts/*.j2` |
| T24 Router local → Gemini → rules, rate limit, logging | **code xong**, có test; còn phải chạy thật với llama-server | `service.py`, `providers/`, `ratelimit.py`, `calllog.py` |
| T25 Prompt advisor + 3 giọng roast; bộ 30 case | **bản đầu xong**; còn phải tinh chỉnh trên model thật + 2 người chấm | `prompts/`, `prompts/testset/cases.yaml` |
| T26 F8 Báo cáo tháng (phía AI) | **xong** phía AI (`monthly_report`); endpoint do Khải gắn | `service.py` |
| T22 llama.cpp, chọn model, benchmark | việc cần làm 31/10–2/11 | [llm/README.md](../../../llm/README.md) |
| T23 `start-demo.ps1` | **script xong**; cần chạy thử trên laptop demo | [scripts/README.md](../../../scripts/README.md) |
| T29 Load test 1/4/5 user | script k6 xong; chạy 11–12/11 | `scripts/loadtest/ai_load.js` |
| T12 Design Document | 29–30/10 | `Documents/` |

## 2. Kiến trúc module

```
app/ai/
  interface.py     CONTRACT: model Pydantic + Protocol AIService (đóng băng 30/10)
  __init__.py      get_ai_service(): dependency FastAPI, singleton
  service.py       DefaultAIService: thử lần lượt từng provider → kiểm tra output → fallback bộ luật
  providers/
    llamacpp.py    llama-server qua OpenAI SDK; semaphore = số slot; tắt "thinking"
    gemini.py      google-genai, thinking_budget=0, chỉ chạy khi có WW_GEMINI_API_KEY
  rules.py         câu trả lời theo luật: fallback cuối cùng VÀ "fake provider" khi dev
  guard.py         kiểm tra output: rỗng, quá dài, từ cấm, số bịa, cắt còn 3 câu, parse JSON
  prompts.py       render Jinja2 từ /prompts; roast_facts() tính sẵn số phụ (còn lại, mỗi ngày…)
  formatting.py    vnd(), parse_amount("1tr2"), big_numbers()
  ratelimit.py     giới hạn N lần/phút/user (in-memory)
  calllog.py       ghi logs/ai_calls.jsonl (task, provider, latency, lỗi; KHÔNG ghi nội dung prompt)
```

Một request đi như sau:

```
advise()/roast()/monthly_report()/parse_entry()
  → rate limit (trừ roast)
  → PromptBuilder render messages (số liệu do code tính, đã format "1.500.000đ")
  → for provider in [local, gemini]:
        raw = provider.complete(...)          # lỗi/timeout → ProviderError → provider tiếp
        text = guard.check_xxx(raw)           # vi phạm → OutputRejectedError → provider tiếp
  → không ai qua: rules.xxx()                 # luôn an toàn, provider="rules", fallback=True
  → calllog.write(...)
```

Chọn chuỗi provider bằng biến môi trường `WW_AI_PROVIDERS`:

| Giá trị | Dùng khi |
|---|---|
| `fake` (mặc định) | dev, CI, máy không có GPU; trả lời bằng bộ luật, `provider="fake"` |
| `local` | đo chất lượng/tốc độ model local riêng |
| `local,gemini` | demo |
| `gemini` | laptop dự phòng không có GPU |

## 3. Lệnh hằng ngày

```powershell
cd backend
uv run pytest tests/ai -q                                   # unit test (không cần GPU)
uv run python ../scripts/run_ai_testset.py                  # 30 case, chế độ giả lập
uv run python ../scripts/run_ai_testset.py --providers local          # trên model thật
uv run python ../scripts/run_ai_testset.py --providers local --only R01,R02,R03
uv run python ../llm/bench.py --concurrency 1 4 5           # tốc độ llama-server
uv run python ../scripts/ai_metrics.py --day 2026-11-12     # metric response time + fallback rate
```

## 4. Quy trình sửa prompt (bắt buộc theo plan §8.4)

1. Nhánh `feature/ai-prompt-<gì>`; sửa file `.j2` trong `prompts/`.
2. `uv run pytest tests/ai` (test render tất cả prompt, StrictUndefined bắt biến thiếu).
3. `run_ai_testset.py --providers local` → file kết quả trong `prompts/testset/results/`.
4. Bạn + 1 người nữa (Khải) điền cột R1/R2 (Y/N). **AI quality score** = số case cả hai cùng Y / 30. Dưới 80% → sửa tiếp, đổi model, hoặc chuyển Gemini làm provider chính (rủi ro R4).
5. Commit file kết quả cùng PR (bằng chứng cho metric).

## 5. Việc tiếp theo, theo thứ tự

1. **30/10 (M1):** cả nhóm duyệt `interface.py`; gửi Khải [INTEGRATION.md §1.4](../../../INTEGRATION.md) (luồng roast) và mục 4–5 của [backend/README.md](../../README.md).
2. **31/10–2/11 (T22):** cài llama.cpp + 2 model ứng viên, chạy `bench.py` và test set với cả hai, chọn 1, ghi kết quả vào `llm/README.md`.
3. **2–4/11 (T23):** chạy `start-demo.ps1` trên laptop demo, sửa nếu cần; đạt M2 cùng Khải và Tùng.
4. **4–9/11 (T24–T25):** tinh chỉnh prompt trên model thật cho đến khi quality ≥ 80%; kiểm tra fallback bằng cách tắt llama-server giữa chừng.
5. **6/11 và 10/11:** tích hợp ([INTEGRATION.md §4](../../../INTEGRATION.md)).
6. **11–12/11 (T29):** k6 với 1/4/5 user qua tunnel; median > 5 s với 4 user → giảm `max_tokens`, model nhỏ hơn hoặc rút gọn prompt.

## 6. Ghi chú thiết kế (dùng cho Design Document)

- **Model không làm toán:** mọi số tính trong service của Khải + `roast_facts()`; guard từ chối output có số lớn (≥ 1.000) không có trong input, nên model không thể "bịa" số tiền.
- **An toàn (R6):** system prompt cấm nói về ngoại hình/danh tính/gia đình; guard chặn danh sách từ cấm; roast tối đa 3 câu, câu cuối là gợi ý; Roast Mode là opt-in; có nút báo cáo tin nhắn.
- **Quyền riêng tư:** prompt chỉ có số tổng hợp + tên danh mục, không có tên/email/ghi chú; log không chứa nội dung prompt.
- **Không cần agent framework:** mỗi tính năng là đúng một prompt, không có tool call hay vòng lặp.
- **Đồng thời:** llama-server `--parallel 4`; phía Python có semaphore cùng kích thước, người thứ 5 xếp hàng thay vì timeout.
