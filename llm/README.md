# Local model server

Optional. Runs a language model on your own GPU so AI replies are private and free. Without it the app falls back to Gemini or to the built-in rule engine.

`llama-server` listens on `127.0.0.1:8080` only; never expose it to the internet.

## Install

Requires an NVIDIA GPU with CUDA 12.4 or newer (check `nvidia-smi`).

```powershell
.\llm\setup-llama.ps1
```

This downloads llama.cpp (CUDA build) into `llm/bin/` and the default model, **Gemma 4 E4B `Q4_K_M`** (about 4.6 GB), into `llm/models/`. Both folders are git-ignored.

Options: `-Build`, `-Cuda`, `-ModelRepo`, `-ModelFile`, `-SkipModel`.

## Run

```powershell
.\llm\start-llama.ps1                                  # 4 slots x 4096 tokens, all layers on the GPU
.\llm\start-llama.ps1 -Model llm\models\other.gguf     # another model
.\llm\start-llama.ps1 -Parallel 2 -CtxPerSlot 3072     # lower if you run out of VRAM
```

Check <http://127.0.0.1:8080/health>; it returns `{"status":"ok"}` when ready. Then start the backend with `WW_AI_PROVIDERS=local,gemini` (or run `scripts/start-demo.ps1`, which does both).

## Benchmark

```powershell
cd backend
uv run python ../llm/bench.py --concurrency 1 4 5
uv run python ../scripts/run_ai_testset.py --providers local
```

Measured on an 8 GB laptop GPU (RTX 2000 Ada), Q4_K_M, 4 parallel slots:

| Model | VRAM | 1 user (median) | 4 users (median / max) | Notes |
|---|---|---|---|---|
| **Gemma 4 E4B** (default) | 3.5 GB | 1.3 s | 2.3 s / 3.3 s | natural Vietnamese, correct figures |
| Qwen3.5-9B | 5.8 GB | 2.8 s | 5.7 s / 7.3 s | accurate but stiffer jokes |
| Gemma 4 12B | 7.9 GB (spills to RAM) | 8.7 s | 25 s / 47 s | best writing, too slow on 8 GB |

Per-run results are in [prompts/testset/results/](../prompts/testset/results/).

## Notes

- Some models (for example Qwen3.5) "think" before answering. The provider disables this, and the server runs with `--jinja --reasoning-budget 0`.
- Image input is not used, so no `mmproj` file is downloaded.
