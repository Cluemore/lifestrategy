#!/usr/bin/env sh
set -eu

# Railway provides PORT at runtime. The fallback also keeps this entry point
# convenient for a local production-style smoke test.
: "${PORT:=8000}"
exec python -m uvicorn main:app --host 0.0.0.0 --port "$PORT"
