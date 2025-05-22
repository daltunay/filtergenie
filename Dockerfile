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
    VIRTUAL_ENV=/app/.venv \
    PYTHONUNBUFFERED=1

ARG DEV=false
ENV DEV=${DEV}

RUN --mount=type=cache,target=/root/.cache/uv \
    if [ "$DEV" = "true" ]; \
    then uv sync --no-install-project; \
    else uv sync --no-install-project --no-dev; \
    fi

ENV PATH="/app/.venv/bin:$PATH"

COPY backend/ ./backend

EXPOSE 8000
HEALTHCHECK CMD curl --fail http://localhost:8000/health || exit 1

COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

ENTRYPOINT ["./docker-entrypoint.sh"]
