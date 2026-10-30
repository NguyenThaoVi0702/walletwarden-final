# Model server local (chủ: Vi, T05 + T22)

Chỉ laptop demo cần phần này. Các thành viên khác dev bằng `WW_AI_PROVIDERS=fake`.

`llama-server` chỉ lắng nghe trên `127.0.0.1:8080`, **không bao giờ** được đưa ra tunnel.

## 1–2. Tải llama.cpp + model (một lệnh)

```powershell
.\llm\setup-llama.ps1
```

Script tải về:
- llama.cpp bản `b12000`, build CUDA 12.4, vào `llm/bin/`. Bản này chạy được nếu `nvidia-smi` báo CUDA Version từ 12.4 trở lên.
- Model mặc định **Qwen3.5-9B `Q4_K_M`** (repo `unsloth/Qwen3.5-9B-GGUF`, khoảng 5.3 GB) vào `llm/models/`.

Tham số: `-Build`, `-Cuda`, `-ModelRepo`, `-ModelFile`, `-SkipModel`.

T22 so sánh thêm **một** ứng viên thứ hai trên bộ 30 case (rủi ro R4). Tải ứng viên bằng `-ModelRepo <repo> -ModelFile <file>`, rồi chạy với `-Model`.

`llm/bin/`, `llm/models/` và `*.gguf` đã bị `.gitignore` bỏ qua, **không commit model**.

Ghi chú:
- Qwen3.5 mặc định "suy nghĩ" trước khi trả lời. Provider đã tắt bằng `chat_template_kwargs.enable_thinking=false`, nên server phải chạy với `--jinja` (script đã bật).
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
| 30/10 | Qwen3.5-9B Q4_K_M, llama.cpp b12000 CUDA 12.4 | 5.8 / 8 GB (RTX 2000 Ada Laptop) | 2.8 s / 3.1 s | 5.7 s / 7.3 s | 5.7 s | 31 (1 user), 18 (4 user) | đang chấm, fallback 0%, quick entry 4/4 |

Ngưỡng hành động (plan §9.1): median > 5 s với 4 user → model nhỏ hơn hoặc prompt ngắn hơn; quality < 80% → đổi prompt/model hoặc dùng Gemini làm chính.
