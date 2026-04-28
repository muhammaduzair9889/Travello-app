# Stage 1: Python dependency builder
FROM python:3.11-slim AS py-builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build

# Build-time only: compiler + PostgreSQL client headers for psycopg2
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# Install into a venv so the entire tree can be COPYed cleanly
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --upgrade pip setuptools wheel && \
    pip install -r requirements.txt


# Stage 2: Node dependency builder (Puppeteer)
FROM node:20-slim AS scraper-builder

WORKDIR /scraper

COPY scraper/package.json scraper/package-lock.json* ./

# Puppeteer downloads its own Chromium into node_modules
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
RUN npm ci --omit=dev && \
    npm cache clean --force


# Stage 3: Production runtime
# Minimal image: only runtime libs, no compilers / headers / caches.
FROM python:3.11-slim AS runtime

LABEL maintainer="Travello Team" \
      description="Travello Django API + Puppeteer scraper" \
      org.opencontainers.image.source="https://github.com/travello/travello"

# All env vars in one layer
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=travello_backend.travello_backend.settings \
    PORT=8000 \
    # Gunicorn picks this up automatically
    WEB_CONCURRENCY=2

# Runtime-only system libraries (no gcc, no -dev packages)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libpq5 curl tini \
        libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
        libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 \
        libgbm1 libpango-1.0-0 libcairo2 libasound2 \
        libxshmfence1 fonts-liberation && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    # Purge curl (no longer needed at runtime)
    apt-get purge -y curl && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Non-root user for runtime security
RUN groupadd -r travello && \
    useradd -r -g travello -d /app -s /sbin/nologin travello

WORKDIR /app

# Copy artefacts from builder stages
COPY --from=py-builder      /opt/venv            /opt/venv
COPY --from=scraper-builder /scraper/node_modules ./scraper/node_modules
ENV PATH="/opt/venv/bin:$PATH"

# Copy application code
COPY . .

# Make entrypoint executable
RUN chmod +x /app/entrypoint.sh

# Ensure writable dirs exist (volumes mount over these in docker-compose)
RUN mkdir -p /app/data /app/media /app/staticfiles && \
    chown -R travello:travello /app

# Drop to non-root
USER travello

EXPOSE ${PORT}

# Tini as PID 1, entrypoint handles migrations + collectstatic
ENTRYPOINT ["tini", "--", "/app/entrypoint.sh"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:${PORT}/health/')" || exit 1

# Daphne ASGI server — supports HTTP + WebSocket
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", \
     "--proxy-headers", \
     "travello_backend.asgi:application"]
