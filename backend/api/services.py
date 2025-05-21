from backend.analyzer import Analyzer
from backend.analyzer.models import FilterModel, ItemModel
from backend.common.cache import (
    get_analysis_result_from_cache,
    get_scraped_item_from_cache,
    make_filters_hash,
    set_analysis_result_cache,
    set_scraped_item_cache,
)
from backend.common.logging import log
from backend.scraper import scrape_item


async def get_cached_scraped_item(
    platform: str,
    url: str,
    max_images: int,
) -> ItemModel | None:
    data = await get_scraped_item_from_cache(platform, url, max_images)
    if data:
        log.debug("Scrape cache hit (redis)", platform=platform, url=url, max_images=max_images)
        return ItemModel(**data)
    return None


async def write_scraped_item_cache(
    item: ItemModel,
    max_images: int,
):
    await set_scraped_item_cache(item.platform, item.url, max_images, item.model_dump())
    log.debug(
        "Scrape cache written (redis)",
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
    platform: str,
    url: str,
    filters: list[FilterModel],
    max_images: int,
) -> list[FilterModel] | None:
    filters_hash = make_filters_hash(filters)
    data = await get_analysis_result_from_cache(platform, url, filters_hash, max_images)
    if data:
        log.debug("Analysis cache hit (redis)", platform=platform, url=url, max_images=max_images)
        return [FilterModel(**f) for f in data]
    return None


async def write_analysis_result_cache(
    item: ItemModel,
    filters: list[FilterModel],
    max_images: int,
):
    filters_hash = make_filters_hash(filters)
    await set_analysis_result_cache(
        item.platform,
        item.url,
        filters_hash,
        max_images,
        [f.model_dump() for f in filters],
    )
    log.debug(
        "Analysis cache written (redis)",
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
