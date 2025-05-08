from backend.analyzer.processor import Analyzer

from .config import settings

_analyzer = Analyzer(
    uselocal=settings.model.uselocal,
    local_config=settings.model.local,
    remote_config=settings.model.remote,
)


def get_analyzer() -> Analyzer:
    """Dependency that provides the analyzer instance."""
    return _analyzer
