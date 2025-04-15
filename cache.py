import asyncio
import functools
import hashlib
import json
import typing as tp

import structlog

_cache = {}
_logger = structlog.get_logger(name="cache")


def _make_key(func_name: str, *args, **kwargs) -> tuple[str, str]:
    """Create a unique key from function name and arguments."""
    try:
        if args and hasattr(args[0], "id") and hasattr(args[0], "filters"):
            product = args[0]
            key_info = {
                "id": product.id,
                "filters": (
                    sorted([f.description for f in product.filters])
                    if product.filters
                    else []
                ),
            }
            args_str = json.dumps(key_info, sort_keys=True)
        elif len(args) > 1 and hasattr(args[1], "id") and hasattr(args[1], "filters"):
            product = args[1]
            key_info = {
                "id": product.id,
                "filters": (
                    sorted([f.description for f in product.filters])
                    if product.filters
                    else []
                ),
            }
            args_str = json.dumps(key_info, sort_keys=True)
        else:
            args_str = str(args)

        kwargs_str = str(sorted(kwargs.items()))
    except Exception:
        args_str = str(args)
        kwargs_str = str(kwargs)

    key_str = f"{func_name}:{args_str}:{kwargs_str}"
    key_hash = hashlib.md5(key_str.encode(), usedforsecurity=False).hexdigest()
    return key_str, key_hash


def cached(func: tp.Callable) -> tp.Callable:
    """Smart cache decorator that works with both sync and async functions."""
    is_async = asyncio.iscoroutinefunction(func)

    if is_async:

        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            func_name = f"{func.__module__}.{func.__qualname__}"
            key_str, key_hash = _make_key(func_name, *args, **kwargs)

            if key_hash in _cache:
                _logger.debug("Cache hit", key=key_str[:100])
                return _cache[key_hash]

            result = await func(*args, **kwargs)
            _cache[key_hash] = result
            _logger.debug("Cache set", key_str=key_str[:100])
            return result

        return async_wrapper
    else:

        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            func_name = f"{func.__module__}.{func.__qualname__}"
            key_str, key_hash = _make_key(func_name, *args, **kwargs)

            if key_hash in _cache:
                _logger.debug("Cache hit", key=key_str[:100])
                return _cache[key_hash]

            result = func(*args, **kwargs)
            _cache[key_hash] = result
            _logger.debug("Cache set", key_str=key_str[:100])
            return result

        return sync_wrapper


def clear_cache() -> None:
    """Clear the entire cache."""
    _cache.clear()
    _logger.info("Cache cleared")
