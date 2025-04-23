import asyncio
import functools
import json
import time
import typing as tp
from dataclasses import dataclass
from hashlib import md5

import structlog

log = structlog.get_logger(__name__=__name__)


@dataclass
class CacheEntry:
    """Holds a cached value and its metadata."""

    value: tp.Any
    created: float
    ttl: int


# Single in-memory cache with integrated metadata
_CACHE: dict[str, CacheEntry] = {}


def _create_key(
    func: tp.Callable,
    args: tuple[tp.Any, ...],
    kwargs: dict[str, tp.Any],
) -> str:
    """Create a unique cache key based on function name and arguments."""
    key_data = {"func": func.__name__, "args": [], "kwargs": {}}

    def _serialize_value(val: tp.Any) -> tp.Any:
        """Helper function to serialize a value for caching."""
        if hasattr(val, "model_dump"):
            return val.model_dump()

        if isinstance(val, (str, int, float, bool, type(None))):
            return val

        if isinstance(val, list) and all(isinstance(item, str) for item in val):
            return sorted(val)

        return str(val)

    key_data["args"] = [_serialize_value(arg) for arg in args]
    key_data["kwargs"] = {k: _serialize_value(v) for k, v in kwargs.items()}

    json_key = json.dumps(key_data, sort_keys=True)
    return md5(json_key.encode()).hexdigest()


def async_cache(ttl: int = 600):
    """
    Decorator to cache async function results.

    Args:
        ttl: Cache time-to-live in seconds (default: 10 minutes)
    """

    def decorator(func: tp.Callable):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            cache_key = _create_key(func, args, kwargs)

            now = time.time()
            if cache_key in _CACHE:
                entry = _CACHE[cache_key]

                if now - entry.created < entry.ttl:
                    log.debug(
                        "Cache hit",
                        function=func.__name__,
                        age=round(now - entry.created, 2),
                        ttl=entry.ttl,
                    )
                    return entry.value

            result = await func(*args, **kwargs)

            _CACHE[cache_key] = CacheEntry(value=result, created=now, ttl=ttl)

            log.debug("Cache miss - stored new result", function=func.__name__)
            return result

        return wrapper

    return decorator


async def cache_cleanup_task(cleanup_interval: int = 60, max_size: int = 1000):
    """
    Background task to clean up expired cache entries.

    Args:
        cleanup_interval: How often to run cleanup (seconds)
        max_size: Maximum number of cache entries
    """
    while True:
        await asyncio.sleep(cleanup_interval)

        now = time.time()
        expired_keys = []

        for key, entry in list(_CACHE.items()):
            is_expired = now - entry.created > entry.ttl
            is_overflow = (len(_CACHE) > max_size) and (
                len(expired_keys) < len(_CACHE) - max_size
            )
            if is_expired or is_overflow:
                expired_keys.append(key)

        for key in expired_keys:
            _CACHE.pop(key)

        if expired_keys:
            log.debug(
                f"Cleaned {len(expired_keys)} expired cache entries",
                remaining=len(_CACHE),
            )
