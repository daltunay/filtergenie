import typing as tp

from backend.analyzer import Analyzer
from backend.common.db import get_async_session_context

_analyzer = Analyzer()


def get_analyzer() -> Analyzer:
    """Dependency that provides the analyzer instance."""
    return _analyzer


async def get_db_session() -> tp.AsyncGenerator:
    """Async dependency that provides a DB session."""
    async with get_async_session_context() as session:
        yield session
