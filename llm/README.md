# Model server local (chủ: Vi, T05 + T22)

Chỉ laptop demo cần phần này. Các thành viên khác dev bằng `WW_AI_PROVIDERS=fake`.

`llama-server` chỉ lắng nghe trên `127.0.0.1:8080`, **không bao giờ** được đưa ra tunnel.

## 1–2. Tải llama.cpp + model (một lệnh)

```powershell
.\llm\setup-llama.ps1
```

Script tải về:
- llama.cpp bản `b12000`, build CUDA 12.4, vào `llm/bin/`. Bản này chạy được nếu `nvidia-smi` báo CUDA Version từ 12.4 trở lên.
- Model mặc định **Gemma 4 E4B `Q4_K_M`** (repo `unsloth/gemma-4-E4B-it-GGUF`, khoảng 4.6 GB) vào `llm/models/`. Lý do chọn: xem mục 4 (T22).

Tham số: `-Build`, `-Cuda`, `-ModelRepo`, `-ModelFile`, `-SkipModel`.

T22 so sánh thêm **một** ứng viên thứ hai trên bộ 30 case (rủi ro R4). Tải ứng viên bằng `-ModelRepo <repo> -ModelFile <file>`, rồi chạy với `-Model`.

`llm/bin/`, `llm/models/` và `*.gguf` đã bị `.gitignore` bỏ qua, **không commit model**.

Ghi chú:
- Một số model (ví dụ Qwen3.5) mặc định "suy nghĩ" trước khi trả lời. Provider tắt bằng `chat_template_kwargs.enable_thinking=false`, và script chạy server với `--jinja --reasoning-budget 0`.
- Model có khả năng nhìn ảnh, nhưng app không cần nên không tải `mmproj`.

## 3. Chạy

```powershell
.\llm\start-llama.ps1                                  # 4 slot × 4096 token, toàn bộ layer lên GPU
.\llm\start-llama.ps1 -Model llm\models\other.gguf     # thử model khác
.\llm\start-llama.ps1 -Parallel 2 -CtxPerSlot 3072     # hết VRAM thì giảm
```

Kiểm tra: http://127.0.0.1:8080/health → `{"status":"ok"}`. Backend dùng nó khi `WW_AI_PROVIDERS=local,gemini`.

## 4. Benchmark (T05/T22, metric "AI response time")

```powershell
cd backend
uv run python ../llm/bench.py --concurrency 1 4 5
uv run python ../scripts/run_ai_testset.py --providers local
```

Ghi kết quả vào bảng dưới đây (đưa vào Design Document và Metrics sheet):

| Ngày | Model | VRAM | 1 user median / max | 4 user median / max | 5 user median | tok/s/user | Quality (30 case) |
|---|---|---|---|---|---|---|---|
| 30/10 | Qwen3.5-9B Q4_K_M, llama.cpp b12000 CUDA 12.4 | 5.8 / 8 GB (RTX 2000 Ada Laptop) | 2.8 s / 3.1 s | 5.7 s / 7.3 s | 5.7 s | 31 (1 user), 18 (4 user) | prompt v1: chấm sơ bộ khoảng 23–25/30, fallback 0%, quick entry 4/4 |
| 30/10 | như trên, prompt v2 (tính sẵn kết luận, tư vấn ≤4 câu) | 5.8 / 8 GB | testset median 3.3 s, chậm nhất 6.0 s (tuần tự) | chưa đo lại | | | chấm sơ bộ khoảng 27/30, fallback 0%, quick entry 4/4; cần 2 người chấm R1/R2 |
| 30/10 | Qwen3.5-9B, roast v3 (≤2 câu, few-shot) | 5.8 / 8 GB | roast 2.2 s | | | | roast đúng số, nhưng câu đùa gượng, ẩn dụ lạ |
| 30/10 | **Gemma 4 E4B Q4_K_M (chọn)** | **3.5 / 8 GB** | **1.25 s / 1.30 s** | **2.27 s / 3.28 s** | 2.12 s / 3.53 s | 43 (1 user), 23 (4 user) | roast tự nhiên nhất trong số chạy được; tư vấn/báo cáo đúng số; quick entry 7/8 ("bia" → Giải trí) |
| 30/10 | Gemma 4 12B Q4_K_M | 7.9 / 8 GB, tràn RAM | 8.7 s | 25 s / 47 s | | 6 (1 user), 2 (4 user) | roast hay nhất nhưng quá chậm, loại; thử lại nếu có GPU ≥ 12 GB |

**Kết luận T22 (30/10):** chọn Gemma 4 E4B. Đây là model duy nhất trong 3 cái đạt ngưỡng < 5 s với 4 user (cả chậm nhất), còn dư VRAM, và viết tiếng Việt tự nhiên hơn Qwen3.5-9B. Kết quả từng model ở `prompts/testset/results/*_qwen35-9b-fewshot.md`, `*_gemma4-e4b*.md`, `*_gemma4-12b.md`.

Ngưỡng hành động (plan §9.1): median > 5 s với 4 user → model nhỏ hơn hoặc prompt ngắn hơn; quality < 80% → đổi prompt/model hoặc dùng Gemini làm chính.
