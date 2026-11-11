# Scripts

Python scripts run from `backend/` so they share its environment: `cd backend; uv run python ../scripts/<file>.py`.

| Script | Purpose |
|---|---|
| `start-demo.ps1` | one command: build the web app, start the model and backend, open a public link with a QR code |
| `seed_demo.py` | create `demo@walletwarden.vn` / `matkhau123` with two months of sample data (`--reset` starts over) |
| `show_qr.py` | print a URL as a QR code and save `scripts/.demo/qr.png` |
| `run_ai_testset.py` | run the 30-case AI test set and write a rating sheet |
| `ai_metrics.py` | summarize `logs/ai_calls.jsonl`: median and max latency, fallback rate |
| `loadtest/ai_load.js` | k6 load test for the AI endpoints |
| `github/` | optional helper that configures a GitHub repository (labels, issues, branch protection) |

## start-demo.ps1

Requires uv, Node.js 22, and [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) (`winget install Cloudflare.cloudflared`). The local model also needs the files from [llm/README.md](../llm/README.md). [ngrok](https://ngrok.com) works as an alternative tunnel (`ngrok config add-authtoken <token>` once).

```powershell
.\scripts\start-demo.ps1                  # full: local model + Cloudflare tunnel
.\scripts\start-demo.ps1 -NoLLM           # no GPU: Gemini if a key is set, otherwise simulated AI
.\scripts\start-demo.ps1 -NoTunnel        # local only, http://localhost:8000
.\scripts\start-demo.ps1 -Tunnel ngrok    # use ngrok instead
.\scripts\start-demo.ps1 -SkipBuild       # reuse the existing frontend build
```

When it prints "WalletWarden is live", scan the QR code with your phone. Press `Ctrl+C` to stop everything; the link stops working at once. A random `WW_JWT_SECRET` is generated unless `.env` sets one. Logs are in `scripts/.demo/`.

To create an account with data, run `seed_demo.py` while the server is up.

If PowerShell refuses to run scripts: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

## Load test

```powershell
winget install k6 --source winget
# create loadtest1..5@walletwarden.test with password Loadtest123! first
k6 run -e BASE_URL=https://xxxx.trycloudflare.com -e VUS=4 scripts/loadtest/ai_load.js
```
