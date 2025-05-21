from backend.analyzer import Analyzer
from backend.common.cache import redis_client

_analyzer = Analyzer()


def get_analyzer() -> Analyzer:
    return _analyzer


async def get_redis():
    yield redis_client
