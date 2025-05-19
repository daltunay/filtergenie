from sqlalchemy.orm import Session

from backend.analyzer import Analyzer
from backend.analyzer.models import FilterModel, ItemModel
from backend.common.cache import analyze_cache, scrape_cache
from backend.scraper import scrape_item


@scrape_cache(scrape_item)
async def cached_scrape_item(
    session: Session,
    platform: str,
    url: str,
    html: str,
    max_images_per_item: int = 1,
) -> ItemModel:
    return scrape_item(platform=platform, url=url, html=html)


@analyze_cache
async def cached_analyze_item(
    session: Session,
    analyzer: Analyzer,
    item: ItemModel,
    filters: list[FilterModel],
    max_images_per_item: int = 1,
) -> list[FilterModel]:
    return await analyzer.analyze_item(item=item, filters=filters)
