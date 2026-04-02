#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT"

echo "[1/8] Building frontend"
cd frontend
npm ci
npm run build

echo "[2/8] Preparing backend"
cd "$ROOT/backend"
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install gunicorn psycopg2-binary

echo "[3/8] Migrate database"
python manage.py migrate

echo "[4/8] Collect static files"
python manage.py collectstatic --noinput

echo "[5/8] Create superuser (interactive)"
python manage.py createsuperuser --email admin@statox.ai || true

echo "[6/8] Run gunicorn (for local tests)"
gunicorn dashboard.wsgi:application --bind 0.0.0.0:8000 --workers 4 &
GUNICORN_PID=$!
sleep 2

echo "[7/8] Smoke tests"
python manage.py check

echo "[8/8] Done"

echo "Gunicorn running as PID $GUNICORN_PID (stop manually with kill $GUNICORN_PID)"
