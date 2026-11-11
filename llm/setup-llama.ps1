<#
.SYNOPSIS
  Download the llama.cpp CUDA build into llm/bin and the default GGUF model into llm/models.

.EXAMPLE
  .\llm\setup-llama.ps1
  .\llm\setup-llama.ps1 -Build b12000 -Cuda 12.4
  .\llm\setup-llama.ps1 -SkipModel
#>
param(
    [string]$Build = "b12000",
    # 12.4 runs on any driver that reports CUDA >= 12.4 in nvidia-smi; 13.4 needs a newer driver.
    [string]$Cuda = "12.4",
    # See the model comparison in llm/README.md.
    [string]$ModelRepo = "unsloth/gemma-4-E4B-it-GGUF",
    [string]$ModelFile = "gemma-4-E4B-it-Q4_K_M.gguf",
    [switch]$SkipModel
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"   # Invoke-WebRequest is very slow with the progress bar

$bin = Join-Path $PSScriptRoot "bin"
$models = Join-Path $PSScriptRoot "models"
New-Item -ItemType Directory -Force $bin, $models | Out-Null

if (-not (Test-Path (Join-Path $bin "llama-server.exe"))) {
    $base = "https://github.com/ggml-org/llama.cpp/releases/download/$Build"
    $tmp = Join-Path ([IO.Path]::GetTempPath()) "llama-$Build"
    New-Item -ItemType Directory -Force $tmp | Out-Null
    foreach ($zip in "llama-$Build-bin-win-cuda-$Cuda-x64.zip", "cudart-llama-bin-win-cuda-$Cuda-x64.zip") {
        Write-Host "Downloading $zip" -ForegroundColor Cyan
        Invoke-WebRequest "$base/$zip" -OutFile (Join-Path $tmp $zip)
        Expand-Archive (Join-Path $tmp $zip) -DestinationPath $bin -Force
    }
    Remove-Item -Recurse -Force $tmp
}
& (Join-Path $bin "llama-server.exe") --version

$modelPath = Join-Path $models $ModelFile
if (-not $SkipModel -and -not (Test-Path $modelPath)) {
    Write-Host "Downloading $ModelRepo/$ModelFile (~4.6 GB)" -ForegroundColor Cyan
    curl.exe -L --fail -o $modelPath "https://huggingface.co/$ModelRepo/resolve/main/$ModelFile"
    if ($LASTEXITCODE -ne 0) { Remove-Item $modelPath -ErrorAction SilentlyContinue; throw "Model download failed" }
}
Write-Host "Done. Start with: .\llm\start-llama.ps1" -ForegroundColor Green
