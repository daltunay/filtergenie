from sqlmodel import Session

from backend.analyzer import Analyzer, FilterModel, ItemModel
from backend.common.cache import cached
from backend.scraper import scrape_item


@cached
async def cached_scrape_item(
    _session: Session,
    platform: str,
    html: str,
) -> ItemModel:
    return scrape_item(platform=platform, html=html)


@cached
async def cached_analyze_item(
    _session: Session,
    analyzer: Analyzer,
    item: ItemModel,
    filters: list[FilterModel],
) -> list[FilterModel]:
    return await analyzer.analyze_item(item=item, filters=filters)
