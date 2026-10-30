<#
.SYNOPSIS
  Start llama.cpp llama-server for WalletWarden on 127.0.0.1:8080 (never exposed to the internet).

.EXAMPLE
  .\llm\start-llama.ps1
  .\llm\start-llama.ps1 -Model .\llm\models\other-model-Q4_K_M.gguf -Parallel 4
#>
param(
    [string]$Model = (Join-Path $PSScriptRoot "models\model.gguf"),
    [string]$Server = (Join-Path $PSScriptRoot "bin\llama-server.exe"),
    [int]$Port = 8080,
    [int]$Parallel = 4,          # simultaneous users (slots)
    [int]$CtxPerSlot = 4096,     # tokens of context per user
    [int]$GpuLayers = 99         # 99 = put every layer on the GPU
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $Server)) {
    $onPath = Get-Command llama-server -ErrorAction SilentlyContinue
    if ($onPath) { $Server = $onPath.Source }
    else { throw "llama-server not found. See llm/README.md (step 1) to download the CUDA build into llm/bin." }
}
if (-not (Test-Path $Model)) {
    throw "Model not found: $Model. See llm/README.md (step 2)."
}

$ctx = $Parallel * $CtxPerSlot
Write-Host "Starting llama-server: $Model, $Parallel slots x $CtxPerSlot ctx, port $Port" -ForegroundColor Cyan

& $Server `
    --model $Model `
    --alias walletwarden-local `
    --host 127.0.0.1 `
    --port $Port `
    --n-gpu-layers $GpuLayers `
    --ctx-size $ctx `
    --parallel $Parallel `
    --cont-batching `
    --jinja `
    --metrics
