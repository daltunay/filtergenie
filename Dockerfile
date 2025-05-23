FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl redis-server && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml uv.lock ./

ENV UV_COMPILE_BYTECODE=1 \
    UV_FROZEN=1 \
    UV_LINK_MODE=copy \
    UV_NO_INSTALLER_METADATA=1 \
    VIRTUAL_ENV=/app/.venv \
    PYTHONUNBUFFERED=1

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --no-install-project --no-dev

ENV PATH="/app/.venv/bin:$PATH"

COPY backend/ ./backend

EXPOSE 8000
HEALTHCHECK CMD curl --fail http://localhost:8000/health || exit 1

ARG CACHE_ENABLED=true
ENV CACHE_ENABLED=${CACHE_ENABLED}

COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

ENTRYPOINT ["./docker-entrypoint.sh"]
