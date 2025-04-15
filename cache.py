import asyncio
import functools
import hashlib
import inspect
import json
import typing as tp

import structlog

# In-memory cache - note: this cache is only preserved for the lifetime of the API process.
# If the API server is restarted, the cache will be reset.
_cache = {}
_logger = structlog.get_logger(name="cache")


def _make_key(func_name: str, *args, **kwargs) -> tuple[str, str]:
    """Create a unique key from function name and arguments."""
    try:
        args_str = str(args)
        kwargs_str = json.dumps(kwargs, sort_keys=True)
    except (TypeError, ValueError):
        args_str = repr(args)
        kwargs_str = repr(sorted(kwargs.items()))

    key_str = f"{func_name}:{args_str}:{kwargs_str}"
    return key_str, hashlib.md5(key_str.encode()).hexdigest()


def cached(func: tp.Callable) -> tp.Callable:
    """Smart cache decorator that works with both sync and async functions."""
    is_async = asyncio.iscoroutinefunction(func) or inspect.iscoroutinefunction(func)

    if is_async:

        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            func_name = f"{func.__module__}.{func.__qualname__}"
            key_str, key_hash = _make_key(func_name, *args, **kwargs)

            if key_hash in _cache:
                _logger.debug("Cache hit", key_str=key_str)
                return _cache[key_hash]

            result = await func(*args, **kwargs)
            _cache[key_hash] = result
            _logger.debug("Cache set", key_str=key_str)
            return result

        return async_wrapper
    else:

        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            func_name = f"{func.__module__}.{func.__qualname__}"
            key = _make_key(func_name, *args, **kwargs)

            if key in _cache:
                _logger.debug("Cache hit", key=key)
                return _cache[key]

            result = func(*args, **kwargs)
            _cache[key] = result
            _logger.debug("Cache set", key=key)
            return result

        return sync_wrapper


def clear_cache() -> None:
    """Clear the entire cache."""
    _cache.clear()
    _logger.info("Cache cleared")
