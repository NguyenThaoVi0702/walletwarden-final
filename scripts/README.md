# Scripts (chủ: Vi)

Tất cả script Python chạy từ thư mục `backend/` để dùng chung môi trường uv: `cd backend; uv run python ../scripts/<file>.py`.

| Script | Dùng để | Task |
|---|---|---|
| `start-demo.ps1` | 1 lệnh chạy cả demo: llama-server → backend → tunnel → link + QR | T23 |
| `show_qr.py` | in QR của link ra terminal + lưu `scripts/.demo/qr.png` | T23 |
| `run_ai_testset.py` | chạy bộ 30 case, xuất file chấm điểm | T25 |
| `ai_metrics.py` | đọc `logs/ai_calls.jsonl` → median/max latency, fallback rate | §9 metrics |
| `loadtest/ai_load.js` | k6 load test AI với 1/4/5 user | T29 |
| `github/setup-github.ps1` | thiết lập GitHub 1 lần: repo, nhánh, nhãn, milestone, 35 issue, branch protection | T04 |
| `github/tasks.csv` | 35 task của plan (nguồn tạo issue) | T04 |

## start-demo.ps1

Cần trên laptop demo: uv, Node 20, `llm/bin/llama-server.exe` + model (xem [llm/README.md](../llm/README.md)), `cloudflared` (`winget install Cloudflare.cloudflared`), dự phòng `ngrok` (`winget install ngrok.ngrok`, rồi `ngrok config add-authtoken <token>` một lần).

```powershell
.\scripts\start-demo.ps1                  # đầy đủ: build FE, model local, cloudflared
.\scripts\start-demo.ps1 -Tunnel ngrok    # tunnel dự phòng
.\scripts\start-demo.ps1 -NoLLM           # máy không GPU: Gemini (nếu có key) hoặc AI giả lập
.\scripts\start-demo.ps1 -NoTunnel        # chỉ localhost:8000
.\scripts\start-demo.ps1 -SkipBuild       # đã build frontend rồi
```

Log từng tiến trình nằm ở `scripts/.demo/*.log`. Ctrl+C dừng tất cả và link hết hiệu lực (rủi ro R8: tắt tunnel sau mỗi buổi).

PowerShell chặn chạy script: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` (một lần).

## Load test (T29)

```powershell
winget install k6 --source winget
# tạo trước tài khoản loadtest1..5@walletwarden.test / Loadtest123! qua trang đăng ký
k6 run -e BASE_URL=https://xxxx.trycloudflare.com -e VUS=1 scripts/loadtest/ai_load.js
k6 run -e BASE_URL=https://xxxx.trycloudflare.com -e VUS=4 scripts/loadtest/ai_load.js
k6 run -e BASE_URL=https://xxxx.trycloudflare.com -e VUS=5 scripts/loadtest/ai_load.js
```

## Thiết lập GitHub (chạy 1 lần, người tạo repo)

```powershell
gh auth login
.\scripts\github\setup-github.ps1 -Vi <github-vi> -Khai <github-khai> -Tung <github-tung>
```

Repo **public** thì branch protection miễn phí; repo private cần GitHub Pro (miễn phí với GitHub Student Developer Pack).
