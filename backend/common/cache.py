import hashlib
import json

import redis.asyncio as redis

from backend.common.logging import log

redis_client = redis.Redis(host="localhost", port=6379, decode_responses=True)


def make_filters_hash(filters: list) -> str:
    filters_json = json.dumps([f.desc for f in filters], sort_keys=True)
    return hashlib.sha256(filters_json.encode("utf-8")).hexdigest()


def scraped_item_cache_key(platform: str, url: str, max_images: int) -> str:
    return f"scraped:{platform}:{url}:{max_images}"


def analysis_result_cache_key(platform: str, url: str, filters_hash: str, max_images: int) -> str:
    return f"analysis:{platform}:{url}:{filters_hash}:{max_images}"


async def get_scraped_item_from_cache(platform: str, url: str, max_images: int) -> dict | None:
    key = scraped_item_cache_key(platform, url, max_images)
    try:
        data = await redis_client.get(key)
        if data:
            return json.loads(data)
    except Exception as e:
        log.exception(f"Error getting scraped item from cache for key {key}: {e}")
    return None


async def set_scraped_item_cache(
    platform: str, url: str, max_images: int, item: dict, ttl: int = 3600
):
    key = scraped_item_cache_key(platform, url, max_images)
    try:
        await redis_client.set(key, json.dumps(item), ex=ttl)
    except Exception as e:
        log.exception(f"Error setting scraped item cache for key {key}: {e}")


async def get_analysis_result_from_cache(
    platform: str, url: str, filters_hash: str, max_images: int
) -> list | None:
    key = analysis_result_cache_key(platform, url, filters_hash, max_images)
    try:
        data = await redis_client.get(key)
        if data:
            return json.loads(data)
    except Exception as e:
        log.exception(f"Error getting analysis result from cache for key {key}: {e}")
    return None


async def set_analysis_result_cache(
    platform: str,
    url: str,
    filters_hash: str,
    max_images: int,
    filters: list,
    ttl: int = 3600,
):
    key = analysis_result_cache_key(platform, url, filters_hash, max_images)
    try:
        await redis_client.set(key, json.dumps(filters), ex=ttl)
    except Exception as e:
        log.exception(f"Error setting analysis result cache for key {key}: {e}")


async def clear_cache() -> int:
    try:
        keys = []
        async for key in redis_client.scan_iter(match="scraped:*"):
            keys.append(key)
        async for key in redis_client.scan_iter(match="analysis:*"):
            keys.append(key)
        if keys:
            await redis_client.delete(*keys)
        return len(keys)
    except Exception as e:
        log.exception(f"Error clearing cache: {e}")
        return 0
