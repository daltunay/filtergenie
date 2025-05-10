import typing as tp

from sqlalchemy.orm import Session

from backend.analyzer import Analyzer
from backend.common.db import SessionLocal

from .config import settings

_analyzer = Analyzer(
    uselocal=settings.model.uselocal,
    local_config=settings.model.local,
    remote_config=settings.model.remote,
)


def get_analyzer() -> Analyzer:
    """Dependency that provides the analyzer instance."""
    return _analyzer


def get_db_session() -> tp.Generator[Session, None, None]:
    """Dependency that provides a DB session."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
