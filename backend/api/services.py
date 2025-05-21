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


async def get_cached_scraped_item(
    session: AsyncSession,
    platform: str,
    url: str,
    max_images: int,
) -> ItemModel | None:
    stmt = get_scrapeditem_query(platform, url, max_images)
    result = await session.execute(stmt)
    item_row = result.scalars().first()
    if item_row:
        log.debug("Scrape cache hit", platform=platform, url=url, max_images=max_images)
        return ItemModel(**item_row.item)
    return None


async def write_scraped_item_cache(
    session: AsyncSession,
    item: ItemModel,
    max_images: int,
):
    session.add(
        ScrapedItem(
            platform=item.platform,
            url=item.url,
            max_images=max_images,
            item=item.model_dump(),
        )
    )
    async with sessionmanager.write_lock:
        await session.commit()
    log.debug(
        "Scrape cache written",
        platform=item.platform,
        url=item.url,
        max_images=max_images,
    )


def scrape_and_truncate_images(
    platform: str,
    url: str,
    html: str,
    max_images: int,
) -> ItemModel:
    item = scrape_item(platform=platform, url=url, html=html)
    item.images = item.images[:max_images]
    return item


async def get_cached_analysis_result(
    session: AsyncSession,
    platform: str,
    url: str,
    filters: list[FilterModel],
    max_images: int,
) -> list[FilterModel] | None:
    filters_hash = make_filters_hash(filters)
    stmt = get_analysisresult_query(platform, url, filters_hash, max_images)
    result = await session.execute(stmt)
    analysis = result.scalars().first()
    if analysis:
        log.debug("Analysis cache hit", platform=platform, url=url, max_images=max_images)
        return [FilterModel(**f) for f in analysis.filters]
    return None


async def write_analysis_result_cache(
    session: AsyncSession,
    item: ItemModel,
    filters: list[FilterModel],
    max_images: int,
):
    filters_hash = make_filters_hash(filters)
    session.add(
        AnalysisResult(
            platform=item.platform,
            url=item.url,
            filters=[f.model_dump() for f in filters],
            filters_hash=filters_hash,
            max_images=max_images,
        )
    )
    async with sessionmanager.write_lock:
        await session.commit()
    log.debug(
        "Analysis cache written",
        platform=item.platform,
        url=item.url,
        max_images=max_images,
    )


async def analyze_item(
    analyzer: Analyzer,
    item: ItemModel,
    filters: list[FilterModel],
) -> list[FilterModel]:
    return await analyzer.analyze_item(item=item, filters=filters)
