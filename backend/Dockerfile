# ============================================================================
#  Social Stats — backend image (Django 4.2 / Channels / Celery)
#
#  Django 4.2 supports Python 3.8–3.12 — pin 3.12, do not float to latest.
#  Serves ASGI via daphne (HTTP + WebSockets). The same image runs the
#  Celery worker and beat — see docker-compose.yml for the three services.
# ============================================================================
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# System deps:
#  - libpq5           → psycopg2 runtime
#  - libpango/cairo/gdk-pixbuf + fonts → weasyprint (PDF reports)
#  - ffmpeg           → moviepy (video studio)
#  - curl             → container healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 \
        libpango-1.0-0 libpangoft2-1.0-0 libcairo2 libgdk-pixbuf-2.0-0 \
        fonts-dejavu-core shared-mime-info \
        ffmpeg \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Build deps only while pip-installing (psycopg2-binary ships wheels, but
# keep gcc handy for any sdist fallback), then drop them.
COPY requirements.txt .
RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev \
    && pip install -r requirements.txt \
    && apt-get purge -y gcc libpq-dev && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

COPY . .

# Collect Django admin static assets (served by whitenoise at runtime).
RUN SECRET_KEY=build-only python manage.py collectstatic --noinput

# Non-root runtime user; media dir must be writable (uploads).
RUN useradd -r -u 999 socialstats \
    && mkdir -p /app/media /app/staticfiles \
    && chown -R socialstats /app/media /app/staticfiles
USER socialstats

EXPOSE 8000

# Default command = ASGI web server. compose overrides this for worker/beat.
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "dashboard.asgi:application"]
