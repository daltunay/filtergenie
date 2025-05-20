from backend.analyzer import Analyzer
from backend.common.db import sessionmanager

_analyzer = Analyzer()


def get_analyzer() -> Analyzer:
    """Dependency that provides the analyzer instance."""
    return _analyzer


async def get_db_session():
    async with sessionmanager.session() as session:
        yield session
