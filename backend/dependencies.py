import structlog

from backend.analyzer.processor import Analyzer
from backend.config import settings

log = structlog.get_logger(__name__=__name__)

_analyzer = Analyzer(
    use_local=settings.model.use_local,
    local_config=settings.model.local,
    remote_config=settings.model.remote,
)
log.info("Analyzer initialized", model=_analyzer.model)


def get_analyzer() -> Analyzer:
    """Dependency that provides the analyzer instance."""
    return _analyzer
