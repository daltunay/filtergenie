from sqlalchemy.orm import Session

from backend.analyzer import Analyzer
from backend.analyzer.models import FilterModel, ItemModel
from backend.common.cache import cached
from backend.scraper import scrape_item


@cached
async def cached_scrape_item(
    session: Session,
    platform: str,
    url: str,
    html: str,
) -> ItemModel:
    return scrape_item(platform=platform, url=url, html=html)


@cached
async def cached_analyze_item(
    session: Session,
    analyzer: Analyzer,
    item: ItemModel,
    filters: list[FilterModel],
) -> list[FilterModel]:
    return await analyzer.analyze_item(item=item, filters=filters)
