import functools
import json
import typing as tp
from hashlib import md5

import structlog
from sqlmodel import select

from backend.common.db import DBEntry, get_from_db, get_session, store_in_db

log = structlog.get_logger(__name__=__name__)


def _create_key(func: tp.Callable, args: tuple, kwargs: dict) -> str:
    """Create a unique cache key based on function name and arguments."""

    def _serialize(val: tp.Any) -> str:
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


def cached(func: tp.Callable):
    """Cache decorator that stores results in database."""

    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        cache_key = _create_key(func, args, kwargs)
        function_name = func.__name__

        # Try to get from database
        db_value = await get_from_db(cache_key)
        if db_value is not None:
            log.debug(
                "Cache hit",
                function=function_name,
                key=cache_key,
            )
            return db_value

        # Cache miss, execute the function
        result = await func(*args, **kwargs)

        # Store in database
        await store_in_db(cache_key, result, function_name)

        return result

    return wrapper


async def clear_cache() -> int:
    """Clear cache entries from database."""

    with get_session() as session:
        entries = session.exec(select(DBEntry)).all()
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
