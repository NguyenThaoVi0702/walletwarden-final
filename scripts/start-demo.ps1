<#
.SYNOPSIS
  One command to run the whole WalletWarden demo from this laptop (T23):
  model server -> backend (serving the React build) -> temporary HTTPS tunnel + QR code.

.EXAMPLE
  .\scripts\start-demo.ps1                    # full demo: local LLM + cloudflared
  .\scripts\start-demo.ps1 -Tunnel ngrok      # backup tunnel
  .\scripts\start-demo.ps1 -NoLLM             # laptop without GPU: Gemini or simulated AI
  .\scripts\start-demo.ps1 -NoTunnel          # local only, http://localhost:8000
#>
param(
    [ValidateSet("cloudflared", "ngrok")] [string]$Tunnel = "cloudflared",
    [switch]$NoLLM,
    [switch]$NoTunnel,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$Demo = Join-Path $PSScriptRoot ".demo"
New-Item -ItemType Directory -Force $Demo | Out-Null
$procs = @()

function Wait-Url([string]$Url, [int]$Seconds, [string]$What) {
    Write-Host "  waiting for $What ..." -NoNewline
    for ($i = 0; $i -lt $Seconds; $i++) {
        try {
            $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
            if ($r.StatusCode -eq 200) { Write-Host " ready" -ForegroundColor Green; return }
        } catch { }
        Start-Sleep -Seconds 1
        Write-Host "." -NoNewline
    }
    throw "$What did not start in $Seconds s (see logs in scripts/.demo)"
}

try {
    if (-not (Test-Path (Join-Path $Root ".env"))) {
        Write-Warning ".env not found - using defaults. Copy .env.example to .env for Gemini and a real JWT secret."
    }

    # 1. Frontend build (served by FastAPI, so one link serves app + API)
    $fe = Join-Path $Root "frontend"
    if (-not $SkipBuild -and (Test-Path (Join-Path $fe "package.json"))) {
        Write-Host "[1/4] Building frontend" -ForegroundColor Cyan
        Push-Location $fe
        npm ci --silent; if ($LASTEXITCODE) { throw "npm ci failed" }
        npm run build; if ($LASTEXITCODE) { throw "frontend build failed" }
        Pop-Location
    } else { Write-Host "[1/4] Frontend build skipped" -ForegroundColor DarkGray }

    # 2. Local model
    if ($NoLLM) {
        $env:WW_AI_PROVIDERS = if ($env:WW_GEMINI_API_KEY) { "gemini" } else { "fake" }
        Write-Host "[2/4] No local LLM, AI providers: $env:WW_AI_PROVIDERS" -ForegroundColor DarkGray
    } else {
        Write-Host "[2/4] Starting llama-server" -ForegroundColor Cyan
        $procs += Start-Process pwsh -PassThru -WindowStyle Minimized `
            -ArgumentList "-NoProfile", "-File", (Join-Path $Root "llm\start-llama.ps1") `
            -RedirectStandardOutput "$Demo\llama.out.log" -RedirectStandardError "$Demo\llama.err.log"
        Wait-Url "http://127.0.0.1:8080/health" 180 "model"
        $env:WW_AI_PROVIDERS = "local,gemini"
    }

    # 3. Backend on port 8000 (the only port the tunnel exposes)
    Write-Host "[3/4] Starting backend" -ForegroundColor Cyan
    $env:WW_ENV = "demo"
    $procs += Start-Process uv -PassThru -NoNewWindow -WorkingDirectory (Join-Path $Root "backend") `
        -ArgumentList "run", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000" `
        -RedirectStandardOutput "$Demo\backend.out.log" -RedirectStandardError "$Demo\backend.err.log"
    Wait-Url "http://127.0.0.1:8000/api/health" 60 "backend"

    # 4. Tunnel
    $url = "http://localhost:8000"
    if ($NoTunnel) {
        Write-Host "[4/4] Tunnel skipped" -ForegroundColor DarkGray
    } elseif ($Tunnel -eq "cloudflared") {
        Write-Host "[4/4] Opening Cloudflare quick tunnel" -ForegroundColor Cyan
        $log = "$Demo\tunnel.log"
        Remove-Item $log -ErrorAction SilentlyContinue
        $procs += Start-Process cloudflared -PassThru -NoNewWindow `
            -ArgumentList "tunnel", "--no-autoupdate", "--url", "http://127.0.0.1:8000" `
            -RedirectStandardOutput "$Demo\tunnel.out.log" -RedirectStandardError $log
        for ($i = 0; $i -lt 60 -and $url -notlike "https://*"; $i++) {
            Start-Sleep -Seconds 1
            if (Test-Path $log) {
                $m = Select-String -Path $log -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" | Select-Object -First 1
                if ($m) { $url = $m.Matches[0].Value }
            }
        }
        if ($url -notlike "https://*") { throw "No tunnel URL. Retry, or use: -Tunnel ngrok" }
    } else {
        Write-Host "[4/4] Opening ngrok tunnel (backup)" -ForegroundColor Cyan
        $procs += Start-Process ngrok -PassThru -WindowStyle Minimized -ArgumentList "http", "8000"
        for ($i = 0; $i -lt 30 -and $url -notlike "https://*"; $i++) {
            Start-Sleep -Seconds 1
            try {
                $t = Invoke-RestMethod "http://127.0.0.1:4040/api/tunnels"
                $u = ($t.tunnels | Where-Object { $_.public_url -like "https://*" } | Select-Object -First 1).public_url
                if ($u) { $url = $u }
            } catch { }
        }
        if ($url -notlike "https://*") { throw "ngrok did not report a URL (run 'ngrok config add-authtoken' once)" }
    }

    Write-Host ""
    Write-Host "  WalletWarden is live. Open on a laptop or scan with a phone:" -ForegroundColor Green
    Push-Location (Join-Path $Root "backend")
    uv run python ..\scripts\show_qr.py $url
    Pop-Location
    Write-Host "  AI health: $url/api/health"
    Write-Host "  Press Ctrl+C to stop everything (the link stops working)." -ForegroundColor Yellow
    while ($true) { Start-Sleep -Seconds 5 }
}
finally {
    Write-Host "`nStopping demo processes..." -ForegroundColor Yellow
    foreach ($p in $procs) {
        if ($p -and -not $p.HasExited) { taskkill /PID $p.Id /T /F 2>$null | Out-Null }
    }
}
