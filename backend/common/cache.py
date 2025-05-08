import functools
import hashlib
import inspect
import json
import types as t

from pydantic import BaseModel
from sqlmodel import select

from backend.common.logging import log

from .db import DBEntry, get_from_db, get_session, store_in_db


def _serialize(val: object) -> object:
    """Serialize a value for caching."""
    if isinstance(val, BaseModel):
        return val.model_dump()
    if isinstance(val, (str, int, float, bool, type(None))):
        return val
    if isinstance(val, (list, set)):
        return sorted([_serialize(item) for item in val], key=str)
    if isinstance(val, tuple):
        return tuple(sorted([_serialize(item) for item in val], key=str))
    if isinstance(val, dict):
        return {k: _serialize(v) for k, v in sorted(val.items())}
    return str(val)


def _create_key(func: t.FunctionType, args: tuple, kwargs: dict) -> str:
    """Create a unique cache key based on function name and arguments."""
    sig = inspect.signature(func)
    bound = sig.bind(*args, **kwargs)
    bound.apply_defaults()

    filtered_args = {k: v for k, v in bound.arguments.items() if not k.startswith("_")}
    key_data = {
        "func": func.__name__,
        "params": {k: _serialize(v) for k, v in filtered_args.items()},
    }
    key_str = json.dumps(key_data, sort_keys=True, separators=(",", ":"))
    return hashlib.md5(key_str.encode()).hexdigest()


def cached(func: t.FunctionType) -> t.FunctionType:
    """Cache decorator that stores results in database."""

    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        cache_key = _create_key(func, args, kwargs)
        function_name = func.__name__

        db_value = await get_from_db(cache_key)
        if db_value is not None:
            log.debug("Cache hit", function=function_name, cache_key=cache_key)
            return db_value

        log.debug(
            "Cache miss, executing function",
            function=function_name,
            cache_key=cache_key,
        )
        result = await func(*args, **kwargs)

        success = await store_in_db(cache_key, result, function_name)
        if not success:
            log.warning(
                "Failed to cache result", function=function_name, cache_key=cache_key
            )
        return result

    return wrapper


async def clear_cache() -> int:
    """Clear cache entries from database."""
    log.debug("Attempting to clear cache entries")
    with get_session() as session:
        entries = session.exec(select(DBEntry)).all()
        count = len(entries)

        for entry in entries:
            session.delete(entry)

        session.commit()
        log.debug("Cache entries cleared", count=count)
        return count
