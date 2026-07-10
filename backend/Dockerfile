# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────────────
# Take My Interview — backend (FastAPI + SQLite + Gemini)
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=7000

# System deps: build-essential is needed by some wheels (e.g. bcrypt) on slim;
# we drop them after pip install to keep the image small.
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first for layer caching
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
 && apt-get purge -y --auto-remove curl \
 && rm -rf /var/lib/apt/lists/*

# Create a non-root user to run the app
RUN groupadd --system app && useradd --system --gid app --home /app app

# Copy application source
COPY server.py auth.py database.py ./
RUN chown -R app:app /app

# PostgreSQL DB runs as a separate container/pod — only DATABASE_URL is needed.
USER app

EXPOSE 7000

# Liveness check — server.py exposes a "/" root endpoint.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request,sys; \
sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/', timeout=3).status == 200 else 1)" \
    || exit 1

# Production entrypoint — no --reload. For local development, run uvicorn
# directly on the host instead of via this image.
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "7000", "--workers", "1"]
