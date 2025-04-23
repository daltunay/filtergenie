import os
from contextlib import asynccontextmanager, contextmanager
from pathlib import Path

import structlog
from sqlmodel import Session, SQLModel, create_engine

log = structlog.get_logger(__name__=__name__)

DB_PATH = os.environ.get("CACHE_DB_PATH", "cache.db")
DB_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DB_URL, connect_args={"check_same_thread": False}, echo=False)


def init_db() -> None:
    """Initialize the database and create tables."""
    log.info("Initializing database", db_path=DB_PATH)

    db_dir = os.path.dirname(DB_PATH)
    if db_dir:
        Path(db_dir).mkdir(parents=True, exist_ok=True)

    SQLModel.metadata.create_all(engine)


@contextmanager
def get_session():
    """Get database session as context manager."""
    session = Session(engine)
    try:
        yield session
    except Exception as e:
        log.error("Database error, rolling back", error=str(e))
        session.rollback()
        raise
    finally:
        session.close()


@asynccontextmanager
async def get_async_session():
    """Async context manager for database session (using sync session underneath)."""
    with get_session() as session:
        yield session
