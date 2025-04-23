FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

RUN apt-get update && \
    apt-get install -y curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml uv.lock ./

ARG USE_LOCAL=false

ENV UV_COMPILE_BYTECODE=1
ENV UV_FROZEN=1
ENV UV_LINK_MODE=copy
ENV UV_NO_INSTALLER_METADATA=1
ENV UV_PROJECT_ENVIRONMENT="/usr/local/"

RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    if [ "$USE_LOCAL" = "true" ]; then \
        EXTRA_ARGS="--extra local"; \
    fi; \
    uv sync --no-install-project --no-dev $EXTRA_ARGS

COPY backend/ ./backend

EXPOSE 8000

ENV PYTHONUNBUFFERED=1
ENV USE_LOCAL=${USE_LOCAL}

CMD ["fastapi", "run", "backend/app.py", "--host", "0.0.0.0", "--port", "8000"]

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl --fail http://localhost:8000/health || exit 1
