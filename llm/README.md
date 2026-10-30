# Model server local (chủ: Vi, T05 + T22)

Chỉ laptop demo cần phần này. Các thành viên khác dev bằng `WW_AI_PROVIDERS=fake`.

`llama-server` chỉ lắng nghe trên `127.0.0.1:8080`, **không bao giờ** được đưa ra tunnel.

## 1. Tải llama.cpp (bản CUDA cho Windows)

1. Vào https://github.com/ggml-org/llama.cpp/releases, tải bản mới nhất dạng
   `llama-<build>-bin-win-cuda-12.x-x64.zip` **và** `cudart-llama-bin-win-cuda-12.x-x64.zip`.
2. Giải nén cả hai vào `llm/bin/` (để có `llm/bin/llama-server.exe`). Thư mục này bị `.gitignore` bỏ qua.
3. Kiểm tra: `.\llm\bin\llama-server.exe --version`.

## 2. Tải model GGUF 4-bit

Plan: model khoảng 8–9B tham số, lượng tử hoá 4-bit (`Q4_K_M`, khoảng 5–6 GB), vừa GPU 8 GB kèm 4 slot ngữ cảnh.
T22 so sánh **hai** ứng viên trên bộ 30 case (rủi ro R4), ưu tiên model instruct đa ngôn ngữ viết tiếng Việt tốt, ví dụ một model họ Qwen hoặc Gemma cỡ 8–9B bản instruct.

```powershell
uv tool install "huggingface_hub[cli]"
huggingface-cli download <repo-gguf> <file>-Q4_K_M.gguf --local-dir llm/models
Rename-Item llm/models/<file>-Q4_K_M.gguf model.gguf      # hoặc truyền -Model khi chạy
```

`llm/models/` và `*.gguf` đã bị `.gitignore` bỏ qua, **không commit model**.

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
| | | | | | | | |

Ngưỡng hành động (plan §9.1): median > 5 s với 4 user → model nhỏ hơn hoặc prompt ngắn hơn; quality < 80% → đổi prompt/model hoặc dùng Gemini làm chính.
