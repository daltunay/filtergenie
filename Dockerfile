FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app

ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy
ENV PLAYWRIGHT_BROWSERS_PATH=/app/ms-playwright

RUN apt update && apt install -y --no-install-recommends

RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --frozen --no-install-project --no-dev

ADD . /app

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

RUN uv run playwright install --with-deps firefox

ENV PATH="/app/.venv/bin:$PATH"

ENTRYPOINT []

CMD ["fastapi", "run", "api.py", "--host", "0.0.0.0", "--port", "8000"]