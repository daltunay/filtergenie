import asyncio
import os
import pickle
import typing as tp
from contextlib import asynccontextmanager, contextmanager
from datetime import datetime, timezone
from pathlib import Path

from loguru import logger
from sqlmodel import Field, Session, SQLModel, create_engine, select

from backend.config import settings

DB_PATH = settings.cache.db_path
DB_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DB_URL, connect_args={"check_same_thread": False}, echo=False)


class DBEntry(SQLModel, table=True):
    """SQLModel for cache entries."""

    key: str = Field(..., primary_key=True)
    value_pickle: bytes = Field(...)
    created: datetime = Field(default=datetime.now(timezone.utc))
    function_name: str = Field(..., index=True)


def init_db() -> None:
    """Initialize the database and create tables."""
    db_dir = os.path.dirname(DB_PATH)
    if db_dir:
        Path(db_dir).mkdir(parents=True, exist_ok=True)

    logger.info(f"Initializing database at {DB_PATH}")
    SQLModel.metadata.create_all(engine)


@contextmanager
def get_session():
    """Get database session as context manager."""
    session = Session(engine)
    try:
        yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


@asynccontextmanager
async def get_async_session():
    """Async context manager for database session (using sync session underneath)."""
    with get_session() as session:
        yield session


async def store_in_db(cache_key: str, value: tp.Any, function_name: str) -> bool:
    """Store an item in the database cache."""
    try:
        value_pickle = pickle.dumps(value)

        async with get_async_session() as session:
            db_entry = DBEntry(
                key=cache_key,
                value_pickle=value_pickle,
                function_name=function_name,
            )

            await asyncio.to_thread(session.add, db_entry)
            await asyncio.to_thread(session.commit)

        return True
    except Exception as e:
        logger.error(f"Failed to store cache entry: {str(e)}")
        return False


async def get_from_db(cache_key: str) -> tp.Any | None:
    """Get an item from the database cache."""
    try:
        async with get_async_session() as session:
            statement = select(DBEntry).where(DBEntry.key == cache_key)
            result = await asyncio.to_thread(session.exec, statement)
            entry: DBEntry | None = result.first()
            return pickle.loads(entry.value_pickle) if entry else None
    except Exception as e:
        logger.error(f"Error retrieving from cache: {str(e)}")
        return None
