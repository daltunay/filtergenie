import asyncio
import functools
import json
import pickle
import time
import typing as tp
from datetime import datetime
from hashlib import md5

import structlog
from sqlmodel import Field, SQLModel, select

from backend.common.db import get_async_session, get_session

log = structlog.get_logger(__name__=__name__)

_MEMORY_CACHE: dict[str, dict[str, tp.Any]] = {}


class CacheEntry(SQLModel, table=True):
    """SQLModel for permanent cache entries."""

    key: str = Field(primary_key=True)
    value_pickle: bytes = Field()
    created: datetime = Field(default_factory=datetime.utcnow)
    function_name: str = Field(index=True)


def _create_key(func: tp.Callable, args: tuple, kwargs: dict) -> str:
    """Create a unique cache key based on function name and arguments."""

    def _serialize(val):
        if hasattr(val, "model_dump"):
            return val.model_dump()
        if isinstance(val, (str, int, float, bool, type(None))):
            return val
        if isinstance(val, list) and all(isinstance(x, str) for x in val):
            return sorted(val)
        return str(val)

    key_data = {
        "func": func.__name__,
        "args": [_serialize(arg) for arg in args],
        "kwargs": {k: _serialize(v) for k, v in kwargs.items()},
    }

    return md5(json.dumps(key_data, sort_keys=True).encode()).hexdigest()


async def _get_from_db(cache_key: str) -> tp.Any | None:
    """Get an item from the database cache."""
    async with get_async_session() as session:
        statement = select(CacheEntry).where(CacheEntry.key == cache_key)
        result = await asyncio.to_thread(session.exec, statement)
        entry = result.first()
        return pickle.loads(entry.value_pickle) if entry else None


async def _store_in_db(cache_key: str, value: tp.Any, function_name: str) -> bool:
    """Store an item in the database cache."""
    try:
        value_pickle = pickle.dumps(value)

        async with get_async_session() as session:
            cache_entry = CacheEntry(
                key=cache_key,
                value_pickle=value_pickle,
                function_name=function_name,
            )

            await asyncio.to_thread(session.add, cache_entry)
            await asyncio.to_thread(session.commit)

        return True
    except Exception as e:
        log.error(f"DB cache store error: {str(e)}", exc_info=True)
        return False


def async_cache(ttl: int = 60):
    """Cache decorator that stores results in memory and database permanently."""

    def decorator(func: tp.Callable):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            cache_key = _create_key(func, args, kwargs)
            function_name = func.__name__
            now = time.time()

            if cache_key in _MEMORY_CACHE:
                entry = _MEMORY_CACHE[cache_key]
                if now - entry["created"] < entry["ttl"]:
                    log.debug(
                        "Memory cache hit",
                        function=function_name,
                        key=cache_key,
                        cache_type="memory",
                    )
                    return entry["value"]

            db_value = await _get_from_db(cache_key)
            if db_value is not None:
                _MEMORY_CACHE[cache_key] = {
                    "value": db_value,
                    "created": now,
                    "ttl": ttl,
                    "function_name": function_name,
                }
                log.debug(
                    "DB cache hit",
                    function=function_name,
                    key=cache_key,
                    cache_type="database",
                )
                return db_value

            result = await func(*args, **kwargs)

            _MEMORY_CACHE[cache_key] = {
                "value": result,
                "created": now,
                "ttl": ttl,
                "function_name": function_name,
            }

            await _store_in_db(cache_key, result, function_name)

            return result

        return wrapper

    return decorator


async def maintain_memory_cache(cleanup_interval: int = 60):
    """Simple periodic task to clean expired memory cache entries."""
    while True:
        await asyncio.sleep(cleanup_interval)

        now = time.time()
        expired_keys = [
            k for k, v in _MEMORY_CACHE.items() if now - v["created"] > v["ttl"]
        ]

        if expired_keys:
            for key in expired_keys:
                _MEMORY_CACHE.pop(key, None)
            log.debug(f"Cleared {len(expired_keys)} expired memory cache entries")


async def clear_cache(memory: bool = True, database: bool = True) -> int:
    """
    Clear cache entries from memory, database, or both."""
    if memory:
        count_memory = len(_MEMORY_CACHE)
        _MEMORY_CACHE.clear()
        log.info(
            f"Cleared {count_memory} entries from memory cache",
            count=count_memory,
            cache_type="memory",
        )
        return count_memory

    if database:
        with get_session() as session:
            entries = session.exec(select(CacheEntry)).all()
            count = len(entries)

            for entry in entries:
                session.delete(entry)

            session.commit()

            if count > 0:
                log.info(
                    f"Cleared {count} entries from database cache",
                    count=count,
                    cache_type="database",
                )
            return count
