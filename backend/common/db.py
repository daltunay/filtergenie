import os
import pickle
import typing as tp
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from sqlmodel import Field, Session, SQLModel, create_engine, select

from backend.common.logging import log
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

    SQLModel.metadata.create_all(engine)
    log.info("Database initialized", db_path=DB_PATH)


def get_session():
    """FastAPI dependency for database session."""
    with Session(engine) as session:
        try:
            yield session
        except Exception:
            session.rollback()
            raise


async def get_async_session():
    """Async FastAPI dependency for database session."""
    session = Session(engine)
    try:
        yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


@contextmanager
def get_session_context():
    """Context manager for database session (for non-FastAPI code)."""
    session = Session(engine)
    try:
        yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


async def store_in_db(
    cache_key: str, value: tp.Any, function_name: str, session: Session | None = None
) -> bool:
    """Store an item in the database cache."""
    try:
        value_pickle = pickle.dumps(value)

        if session is None:
            with get_session_context() as session:
                db_entry = DBEntry(
                    key=cache_key,
                    value_pickle=value_pickle,
                    function_name=function_name,
                )
                session.add(db_entry)
                session.commit()
        else:
            db_entry = DBEntry(
                key=cache_key,
                value_pickle=value_pickle,
                function_name=function_name,
            )
            session.add(db_entry)
            session.commit()

        log.debug("Cache entry stored", function=function_name, cache_key=cache_key)
        return True
    except Exception as e:
        log.error(
            "Failed to store cache entry",
            error=str(e),
            function=function_name,
            cache_key=cache_key,
            exc_info=e,
        )
        return False


async def get_from_db(cache_key: str, session: Session | None = None) -> tp.Any | None:
    """Get an item from the database cache."""
    try:
        if session is None:
            with get_session_context() as session:
                statement = select(DBEntry).where(DBEntry.key == cache_key)
                entry: DBEntry | None = session.exec(statement).first()
        else:
            statement = select(DBEntry).where(DBEntry.key == cache_key)
            entry: DBEntry | None = session.exec(statement).first()

        if entry:
            log.debug("Retrieved from cache", function=entry.function_name, cache_key=cache_key)

        return pickle.loads(entry.value_pickle) if entry else None
    except Exception as e:
        log.error("Error retrieving from cache", error=str(e), cache_key=cache_key, exc_info=e)
        return None
