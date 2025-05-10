import functools
import json
import types as t

from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.analyzer import Analyzer
from backend.analyzer.models import FilterModel, ItemModel
from backend.common.db import AnalysisResult, ScrapedItem
from backend.common.logging import log


def _serialize(val: object) -> object:
    """Serialize a value for caching."""
    if isinstance(val, BaseModel):
        return val.model_dump()
    if isinstance(val, (str, int, float, bool, type(None))):
        return val
    if isinstance(val, (list, set, tuple)):
        return [_serialize(item) for item in val]
    if isinstance(val, dict):
        return {k: _serialize(v) for k, v in sorted(val.items())}
    return str(val)


def scrape_cache(func: t.FunctionType) -> t.FunctionType:
    """Decorator for caching scraped items."""

    @functools.wraps(func)
    async def wrapper(session: Session, platform: str, url: str, html: str, *args, **kwargs):
        item = session.query(ScrapedItem).filter_by(platform=platform, url=url).first()
        if item:
            log.debug("Scrape cache hit", platform=platform, url=url)
            return func.__globals__["scrape_item"](platform=platform, url=url, html=item.html)
        log.debug("Scrape cache miss", platform=platform, url=url)
        result = await func(session, platform, url, html, *args, **kwargs)
        session.add(ScrapedItem(platform=platform, url=url, html=html))
        session.commit()
        return result

    return wrapper


def analyze_cache(func: t.FunctionType) -> t.FunctionType:
    """Decorator for caching analysis results."""

    @functools.wraps(func)
    async def wrapper(
        session: Session,
        analyzer: Analyzer,
        item: ItemModel,
        filters: list[FilterModel],
        *args,
        **kwargs,
    ) -> list[FilterModel]:
        platform = item.platform
        url = item.url
        filters_json = json.dumps([f.desc for f in filters], sort_keys=True)
        analysis = session.query(AnalysisResult).filter_by(platform=platform, url=url).first()
        if analysis and analysis.filters == json.loads(filters_json):
            log.debug("Analysis cache hit", platform=platform, url=url)
            return [FilterModel(**f) for f in analysis.filters]
        log.debug("Analysis cache miss", platform=platform, url=url)
        result = await func(session, analyzer, item, filters, *args, **kwargs)
        session.add(
            AnalysisResult(
                platform=platform,
                url=url,
                item=item.model_dump(),
                filters=[f.model_dump() for f in result],
            )
        )
        session.commit()
        return result

    return wrapper


def cached(func: t.FunctionType) -> t.FunctionType:
    """Decorator that dispatches to scrape_cache or analyze_cache based on function name."""
    if func.__name__ == "cached_scrape_item":
        return scrape_cache(func)
    elif func.__name__ == "cached_analyze_item":
        return analyze_cache(func)
    return func


async def clear_cache(session: Session) -> int:
    """Clear cache entries from database."""
    scraped = session.query(ScrapedItem).delete()
    analyzed = session.query(AnalysisResult).delete()
    session.commit()
    count = scraped + analyzed
    log.debug("Cache entries cleared", count=count)
    return count
