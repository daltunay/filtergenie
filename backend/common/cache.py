import functools
import hashlib
import json
import types as t

from sqlmodel import select

from backend.common.db import DBEntry, get_from_db, get_session, store_in_db


def _create_key(func: t.FunctionType, args: tuple, kwargs: dict) -> str:
    """Create a unique cache key based on function title and arguments."""

    def _serialize(val):
        if hasattr(val, "model_dump"):
            return val.model_dump()
        if isinstance(val, (str, int, float, bool, type(None))):
            return val
        if isinstance(val, list):
            return sorted([_serialize(item) for item in val])
        if isinstance(val, tuple):
            return tuple(sorted(_serialize(item) for item in val))
        if isinstance(val, set):
            return sorted([_serialize(item) for item in val])
        if isinstance(val, dict):
            return {k: _serialize(v) for k, v in val.items()}
        return str(val)

    key_data = {
        "func": func.__name__,
        "args": [_serialize(arg) for arg in args],
        "kwargs": {k: _serialize(v) for k, v in kwargs.items()},
    }

    key_json = json.dumps(key_data, sort_keys=True, separators=(",", ": "))
    return hashlib.md5(key_json.encode()).hexdigest()


def cached(func: t.FunctionType) -> t.FunctionType:
    """Cache decorator that stores results in database."""

    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        cache_key = _create_key(func, args, kwargs)
        function_name = func.__name__

        db_value = await get_from_db(cache_key)
        if db_value is not None:
            return db_value

        result = await func(*args, **kwargs)
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
        return count
