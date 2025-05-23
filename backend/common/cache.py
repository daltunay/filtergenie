import hashlib
import json
import types as t
import typing as tp
from functools import partial

import redis.asyncio as redis

from backend.analyzer.models import FilterModel
from backend.common.logging import log
from backend.config import settings

redis_client = redis.Redis(host="localhost", port=6379, decode_responses=True)


def _make_filters_hash(filters: list[FilterModel]) -> str:
    filters_json = json.dumps([f.desc for f in filters], sort_keys=True)
    return hashlib.sha256(filters_json.encode("utf-8")).hexdigest()


def make_cache_key(
    key_type: tp.Literal["scraped", "analysis"],
    platform: str,
    url: str,
    max_images: int,
    filters: list[FilterModel] | None = None,
) -> str:
    if key_type == "scraped":
        return f"scraped:{platform}:{url}:{max_images}"
    if key_type == "analysis":
        filters_hash = _make_filters_hash(filters or [])
        return f"analysis:{platform}:{url}:{filters_hash}:{max_images}"


def redis_catch(func: t.FunctionType) -> t.FunctionType:
    async def wrapper(*args, **kwargs):
        if not settings.cache_enabled:
            return None
        try:
            return await func(*args, **kwargs)
        except Exception as e:
            log.error(f"Redis operation error: {e}")

    return wrapper


@redis_catch
async def get_cache(
    key_type: tp.Literal["scraped", "analysis"],
    platform: str,
    url: str,
    max_images: int,
    filters: list[FilterModel] | None = None,
) -> dict | list | None:
    key = make_cache_key(key_type, platform, url, max_images, filters)
    data = await redis_client.get(key)
    if data:
        return json.loads(data)
    return None


@redis_catch
async def set_cache(
    key_type: tp.Literal["scraped", "analysis"],
    platform: str,
    url: str,
    max_images: int,
    value: dict | list,
    filters: list[FilterModel] | None = None,
    ttl: int = 3600,
):
    key = make_cache_key(key_type, platform, url, max_images, filters)
    await redis_client.set(key, json.dumps(value), ex=ttl)


get_scraped_cache = partial(get_cache, "scraped")
get_analysis_cache = partial(get_cache, "analysis")
set_scraped_cache = partial(set_cache, "scraped")
set_analysis_cache = partial(set_cache, "analysis")


@redis_catch
async def clear_cache() -> int:
    keys_count = await redis_client.dbsize()
    if keys_count == 0:
        log.info("Cache is already empty")
        return 0
    await redis_client.flushdb(asynchronous=True)
    log.info("Cache cleared", keys_cleared=keys_count)
    return keys_count


@redis_catch
async def close_redis_client():
    await redis_client.close()
