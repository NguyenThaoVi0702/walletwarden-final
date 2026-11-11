<p align="center"><img src="assets/brand/logo-192.png" width="120" alt="WalletWarden logo"></p>

<h1 align="center">WalletWarden</h1>

<p align="center"><em>Spend less. Or get roasted.</em></p>

WalletWarden is a personal finance assistant with an AI sidekick. Track income and expenses, set monthly budgets, see where your money goes, ask the AI for advice, and get a (friendly or savage) roast when you overspend. The interface is in Vietnamese and amounts are in VND.

Everything runs on a single computer: the web app, the database and, optionally, a local language model. You can use it from the same computer or open it on your phone.

## Features

- **Accounts:** register and sign in with email and password.
- **Transactions:** add, edit, delete, browse by month and export to CSV. Type amounts naturally: `45k`, `1tr2`, `1.500.000`.
- **Categories and budgets:** default categories, custom colors and icons, an overall monthly budget plus per-category limits.
- **Dashboard:** spending by category and by day, and budget progress for the selected month.
- **AI advisor:** ask questions about your spending, or just type "ate breakfast for 50k" and it is logged for you.
- **Roast mode:** alerts when a budget is nearly or fully used, when a purchase is unusually large, and in other situations, in a gentle, honest or savage tone.
- **Monthly report:** a written summary of the month.
- **Installable PWA:** add it to your phone's home screen and use it like a native app.

AI replies come from a local model first, then the Gemini API, and finally a built-in rule-based engine, so the app always answers even without a GPU or an API key.

## Requirements

| Tool | Version | Notes |
|---|---|---|
| [Git](https://git-scm.com) | any | to clone the repository |
| [uv](https://docs.astral.sh/uv/) | latest | installs Python 3.12 and the backend dependencies |
| [Node.js](https://nodejs.org) | 22 LTS | builds the web app |

Optional: an NVIDIA GPU for the local model, a [Gemini API key](https://aistudio.google.com/apikey), and [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) for a public link. Windows users should run PowerShell commands from a normal PowerShell window.

## Quick start (computer)

```powershell
git clone https://github.com/NguyenThaoVi0702/walletwarden.git
cd walletwarden
copy .env.example .env          # use `cp` on macOS/Linux

cd frontend
npm ci
npm run build                   # creates frontend/dist, served by the backend
cd ../backend
uv sync
uv run alembic upgrade head     # creates the SQLite database
uv run uvicorn app.main:app --port 8000
```

Open <http://localhost:8000>, click **Register** and start tracking. API documentation is at <http://localhost:8000/docs>.

To try the app with two months of sample data, run this in a second terminal while the server is running:

```powershell
cd backend
uv run python ../scripts/seed_demo.py
```

Then sign in with `demo@walletwarden.vn` / `matkhau123`. Add `--reset` to start the sample account over.

## Use it on your phone

Pick whichever option fits.

### Option 1: public link and QR code (any network)

One script builds the app, starts the server and opens a temporary HTTPS link:

```powershell
winget install Cloudflare.cloudflared    # once; reopen the terminal afterwards
.\scripts\start-demo.ps1 -NoLLM          # drop -NoLLM if you set up the local model
```

Scan the QR code printed in the terminal, or open the `https://….trycloudflare.com` link on your phone. The link works only while the script is running; press `Ctrl+C` to stop it. See [scripts/README.md](scripts/README.md) for all options.

### Option 2: same Wi-Fi network

Start the server so it accepts connections from other devices:

```powershell
cd backend
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Find your computer's IP address (`ipconfig` on Windows, look for *IPv4 Address*) and open `http://<that-ip>:8000` on your phone. If it does not load, allow Python through the firewall for private networks.

### Install it as an app

Open the link in Chrome (Android) or Safari (iPhone), then choose **Add to Home screen**. Installing requires HTTPS, so use Option 1 for this.

## Configuration

Settings are read from environment variables or from `.env` in the repository root. Copy [.env.example](.env.example) to start.

| Variable | Default | Purpose |
|---|---|---|
| `WW_AI_PROVIDERS` | `fake` | AI chain: `fake` (rules only), `local`, `gemini`, or a list such as `local,gemini` |
| `WW_GEMINI_API_KEY` | empty | Needed for the `gemini` provider |
| `WW_JWT_SECRET` | dev value | Long random string that signs sign-in tokens. **Required** when `WW_ENV` is not `dev` (the demo script generates one for you) |
| `WW_DATABASE_URL` | `sqlite:///./walletwarden.db` | Database location |

## Local AI model (optional)

With an NVIDIA GPU you can run the language model on your own machine. See [llm/README.md](llm/README.md), then start with `WW_AI_PROVIDERS=local,gemini`.

## Project layout

```
backend/     FastAPI application, SQLite models, AI module, tests
frontend/    React + TypeScript + Vite progressive web app
prompts/     Prompt templates and the AI test set
llm/         Scripts to install and run the local model
scripts/     Demo launcher, sample data, QR code, load test
tests/       Cross-component test notes
assets/      Logo and brand colors
```

## Documentation

- [API reference](backend/API_README.md) and the OpenAPI contract in [backend/openapi.json](backend/openapi.json)
- [Backend guide](backend/README.md) · [Frontend guide](frontend/README.md) · [AI module](backend/app/ai/README.md)
- [Contributing](CONTRIBUTING.md)

## Troubleshooting

| Problem | Fix |
|---|---|
| `Port 8000 is already in use` | Stop the other server, or use `--port 8001` |
| The page shows an old version | Hard refresh (`Ctrl+F5`); the app caches itself as a PWA |
| `WW_JWT_SECRET must be set` | Set a long random value in `.env` (any `WW_ENV` other than `dev` needs it) |
| `cloudflared` is not recognized | Reopen the terminal after installing, or use Option 2 |
| Registration or sign-in returns 429 | Too many attempts; wait a minute |
| `uv` fails on OneDrive folders | `$env:UV_LINK_MODE="copy"` and retry |
| Script blocked by PowerShell | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
