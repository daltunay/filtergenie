import hashlib
import json

from backend.common.db import AnalysisResult, ScrapedItem


def make_filters_hash(filters: list) -> str:
    filters_json = json.dumps([f.desc for f in filters], sort_keys=True)
    return hashlib.sha256(filters_json.encode("utf-8")).hexdigest()


def get_scrapeditem_query(platform: str, url: str, max_images: int):
    from sqlalchemy import select

    return (
        select(ScrapedItem)
        .where(
            ScrapedItem.platform == platform,
            ScrapedItem.url == url,
            ScrapedItem.max_images >= max_images,
        )
        .order_by(ScrapedItem.max_images.asc())
    )


def get_analysisresult_query(platform: str, url: str, filters_hash: str, max_images: int):
    from sqlalchemy import select

    return (
        select(AnalysisResult)
        .where(
            AnalysisResult.platform == platform,
            AnalysisResult.url == url,
            AnalysisResult.filters_hash == filters_hash,
            AnalysisResult.max_images >= max_images,
        )
        .order_by(AnalysisResult.max_images.asc())
    )


async def clear_cache(session) -> int:
    from sqlalchemy import delete

    from backend.common.db import AnalysisResult, ScrapedItem
    from backend.common.logging import log

    scraped_result = await session.execute(delete(ScrapedItem))
    analyzed_result = await session.execute(delete(AnalysisResult))
    await session.commit()
    count = scraped_result.rowcount + analyzed_result.rowcount
    log.debug("Cache entries cleared", count=count)
    return count
