import functools
import hashlib
import inspect
import json
import types as t
import typing as tp

from pydantic import BaseModel
from sqlmodel import Session, select

from backend.common.logging import log

from .db import DBEntry, get_from_db, store_in_db


def _serialize(val: object) -> object:
    """Serialize a value for caching."""
    if isinstance(val, BaseModel):
        return val.model_dump()
    if isinstance(val, (str, int, float, bool, type(None))):
        return val
    if isinstance(val, (list, set, tuple)):
        return [_serialize(item) for item in val]
    if isinstance(val, dict):
        return {k: _serialize(v) for k, v in sorted(val.items())}
    return str(val)


def _create_key(func: t.FunctionType, args: tuple, kwargs: dict) -> tuple[str, str]:
    """Create a unique cache key based on function name and arguments."""
    sig = inspect.signature(func)
    bound = sig.bind(*args, **kwargs)
    bound.apply_defaults()

    filtered_args = {k: v for k, v in bound.arguments.items() if not k.startswith("_")}
    key_data = {
        "func": func.__name__,
        "params": {k: _serialize(v) for k, v in filtered_args.items()},
    }
    key_str = json.dumps(key_data, sort_keys=True)
    key_hash = hashlib.md5(key_str.encode()).hexdigest()
    return key_str, key_hash


def cached(func: t.FunctionType) -> t.FunctionType:
    """Cache decorator that stores results in database."""

    @functools.wraps(func)
    async def wrapper(session: Session, *args, **kwargs) -> tp.Any:
        key_str, key_hash = _create_key(func, (session, *args), kwargs)
        function_name = func.__name__

        db_value = await get_from_db(key_hash, session)
        if db_value is not None:
            log.debug(
                "Cache hit",
                function=function_name,
                key_hash=key_hash,
                # key_str=key_str,
            )
            return db_value

        log.debug(
            "Cache miss, executing function",
            function=function_name,
            key_hash=key_hash,
            # key_str=key_str,
        )
        result = await func(session, *args, **kwargs)

        success = await store_in_db(key_hash, result, function_name, session)
        if not success:
            log.warning(
                "Failed to cache result",
                function=function_name,
                key_hash=key_hash,
                # key_str=key_str,
            )
        return result

    return wrapper


async def clear_cache(session: Session) -> int:
    """Clear cache entries from database."""
    log.debug("Attempting to clear cache entries")

    entries = session.exec(select(DBEntry)).all()  # ty: ignore[no-matching-overload]
    count = len(entries)

    for entry in entries:
        session.delete(entry)

    session.commit()
    log.debug("Cache entries cleared", count=count)
    return count
