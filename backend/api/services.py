from fastapi import BackgroundTasks

from backend.analyzer import Analyzer
from backend.analyzer.models import FilterModel, ItemModel
from backend.common.cache import (
    get_analysis_cache,
    get_scraped_cache,
    set_analysis_cache,
    set_scraped_cache,
)
from backend.common.logging import log
from backend.config import settings
from backend.scraper import scrape_item


async def get_or_scrape_item(
    platform: str,
    url: str,
    html: str,
    max_images: int,
    background_tasks: BackgroundTasks,
) -> ItemModel:
    if settings.cache_enabled:
        item_data = await get_scraped_cache(platform=platform, url=url, max_images=max_images)
        if item_data:
            log.debug(
                "Scrape cache hit",
                platform=platform,
                url=url,
                max_images=max_images,
            )
            return ItemModel(**item_data)
    item = scrape_item(platform=platform, url=url, html=html)
    item.images = item.images[:max_images]

    if settings.cache_enabled:
        background_tasks.add_task(
            set_scraped_cache,
            platform,
            url,
            max_images,
            item.model_dump(),
        )
        log.debug(
            "Scrape cache write scheduled",
            platform=platform,
            url=url,
            max_images=max_images,
        )
    return item


async def get_or_analyze_filters(
    analyzer: Analyzer,
    item: ItemModel,
    filters: list[FilterModel],
    max_images: int,
    background_tasks: BackgroundTasks,
) -> list[FilterModel]:
    if settings.cache_enabled:
        data = await get_analysis_cache(
            platform=item.platform, url=item.url, max_images=max_images, filters=filters
        )
        if data:
            log.debug(
                "Analysis cache hit",
                platform=item.platform,
                url=item.url,
                max_images=max_images,
            )
            return [FilterModel(**f) for f in data]
    analyzed_filters = await analyzer.analyze_item(item=item, filters=filters)

    if settings.cache_enabled:
        background_tasks.add_task(
            set_analysis_cache,
            item.platform,
            item.url,
            max_images,
            [f.model_dump() for f in analyzed_filters],
            filters,
        )
        log.debug(
            "Analysis cache write scheduled",
            platform=item.platform,
            url=item.url,
            max_images=max_images,
        )
    return analyzed_filters
