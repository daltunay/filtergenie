from sqlalchemy.ext.asyncio import AsyncSession

from backend.analyzer import Analyzer
from backend.analyzer.models import FilterModel, ItemModel
from backend.common.cache import (
    get_analysisresult_query,
    get_scrapeditem_query,
    make_filters_hash,
)
from backend.common.db import AnalysisResult, ScrapedItem, sessionmanager
from backend.common.logging import log
from backend.scraper import scrape_item


async def cached_scrape_item(
    session: AsyncSession,
    platform: str,
    url: str,
    html: str,
    max_images: int = 1,
) -> ItemModel:
    stmt = get_scrapeditem_query(platform, url, max_images)
    result = await session.execute(stmt)
    item_row = result.scalars().first()
    if item_row:
        log.debug(
            "Scrape cache hit",
            platform=platform,
            url=url,
            max_images=max_images,
        )
        return ItemModel(**item_row.item)
    log.debug(
        "Scrape cache miss",
        platform=platform,
        url=url,
        max_images=max_images,
    )
    item = scrape_item(platform=platform, url=url, html=html)
    item.images = item.images[:max_images]
    async with sessionmanager.write_lock:
        session.add(
            ScrapedItem(
                platform=platform,
                url=url,
                max_images=max_images,
                item=item.model_dump(),
            )
        )
        await session.commit()
    return item


async def cached_analyze_item(
    session: AsyncSession,
    analyzer: Analyzer,
    item: ItemModel,
    filters: list[FilterModel],
    max_images: int = 1,
) -> list[FilterModel]:
    platform = item.platform
    url = item.url
    filters_hash = make_filters_hash(filters)
    stmt = get_analysisresult_query(platform, url, filters_hash, max_images)
    result = await session.execute(stmt)
    analysis = result.scalars().first()
    if analysis:
        log.debug(
            "Analysis cache hit",
            platform=platform,
            url=url,
            max_images=max_images,
        )
        return [FilterModel(**f) for f in analysis.filters]
    log.debug(
        "Analysis cache miss",
        platform=platform,
        url=url,
        max_images=max_images,
    )
    result_filters = await analyzer.analyze_item(item=item, filters=filters)
    async with sessionmanager.write_lock:
        session.add(
            AnalysisResult(
                platform=platform,
                url=url,
                filters=[f.model_dump() for f in result_filters],
                filters_hash=filters_hash,
                max_images=max_images,
            )
        )
        await session.commit()
    return result_filters
