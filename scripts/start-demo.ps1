<#
.SYNOPSIS
  Run WalletWarden end to end: build the web app, start the local model (optional) and the
  backend, then open a temporary HTTPS link with a QR code for phones.

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
        Write-Warning ".env not found - using defaults. Copy .env.example to .env to configure Gemini."
    }
    # Sign-in tokens need a secret outside dev mode; use a random one unless .env provides it.
    $envFile = Join-Path $Root ".env"
    $hasSecret = $env:WW_JWT_SECRET -or ((Test-Path $envFile) -and (Select-String -Path $envFile -Pattern '^\s*WW_JWT_SECRET=(?!change-me)\S{16,}' -Quiet))
    if (-not $hasSecret) {
        $env:WW_JWT_SECRET = -join ((1..48) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
        Write-Host "  WW_JWT_SECRET not set - generated a temporary one (everyone is signed out on restart)." -ForegroundColor DarkGray
    }

    # 1. Frontend build (served by the backend, so one link serves the app and the API)
    $fe = Join-Path $Root "frontend"
    if (-not $SkipBuild -and (Test-Path (Join-Path $fe "package.json"))) {
        Write-Host "[1/4] Building frontend" -ForegroundColor Cyan
        Push-Location $fe
        npm ci --silent; if ($LASTEXITCODE) { throw "npm ci failed" }
        npm run build; if ($LASTEXITCODE) { throw "frontend build failed" }
        Pop-Location
    } else { Write-Host "[1/4] Frontend build skipped" -ForegroundColor DarkGray }

    # 2. Language model
    if ($NoLLM) {
        $env:WW_AI_PROVIDERS = if ($env:WW_GEMINI_API_KEY) { "gemini" } else { "fake" }
        Write-Host "[2/4] No local LLM, AI providers: $env:WW_AI_PROVIDERS" -ForegroundColor DarkGray
    } else {
        Write-Host "[2/4] Starting llama-server" -ForegroundColor Cyan
        $procs += Start-Process pwsh -PassThru -WindowStyle Minimized `
            -ArgumentList "-NoProfile", "-File", "`"$(Join-Path $Root 'llm\start-llama.ps1')`"" `
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
