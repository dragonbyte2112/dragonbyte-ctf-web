#!/usr/bin/env bash
# Dragon Bytes CTF Arena — quick start
set -e
cd "$(dirname "$0")/backend"

if [ ! -d ".venv" ]; then
  echo "Creating virtual environment..."
  python3 -m venv .venv
fi

source .venv/bin/activate
pip install -q -r requirements.txt

echo ""
echo "🐉 Starting Dragon Bytes CTF Arena at http://localhost:8000"
echo ""
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000
