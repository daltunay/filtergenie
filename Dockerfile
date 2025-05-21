FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

RUN apt-get update && \
    apt-get install -y curl redis-server && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml uv.lock ./

ENV UV_COMPILE_BYTECODE=1 \
    UV_FROZEN=1 \
    UV_LINK_MODE=copy \
    UV_NO_INSTALLER_METADATA=1 \
    VIRTUAL_ENV=/app/.venv

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --no-install-project --no-dev

ARG API_PROFILING_ENABLED=false

RUN if [ "$API_PROFILING_ENABLED" = "true" ]; then \
    uv pip install pyinstrument; \
    fi

ENV PATH="/app/.venv/bin:$PATH"

COPY backend/ ./backend

RUN mkdir -p /app/data

ENV PYTHONUNBUFFERED=1

EXPOSE 8000
HEALTHCHECK CMD curl --fail http://localhost:8000/health || exit 1

COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

ENTRYPOINT ["/app/docker-entrypoint.sh"]
