import functools
import hashlib
import json
import types as t

from sqlalchemy.orm import Session

from backend.analyzer import Analyzer
from backend.analyzer.models import FilterModel, ItemModel
from backend.common.db import AnalysisResult, ScrapedItem
from backend.common.logging import log


def scrape_cache(scrape_func):
    """Decorator for caching scraped items, now takes scrape_func as argument."""

    def decorator(func: t.FunctionType) -> t.FunctionType:
        @functools.wraps(func)
        async def wrapper(session: Session, platform: str, url: str, html: str, *args, **kwargs):
            item = session.query(ScrapedItem).filter_by(platform=platform, url=url).first()
            if item:
                log.debug("Scrape cache hit", platform=platform, url=url)
                return scrape_func(platform=platform, url=url, html=item.html)
            log.debug("Scrape cache miss", platform=platform, url=url)
            result = await func(session, platform, url, html, *args, **kwargs)
            session.add(ScrapedItem(platform=platform, url=url, html=html))
            session.commit()
            return result

        return wrapper

    return decorator


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
        filters_hash = hashlib.sha256(filters_json.encode("utf-8")).hexdigest()
        analysis = (
            session.query(AnalysisResult)
            .filter_by(platform=platform, url=url, filters_hash=filters_hash)
            .first()
        )
        if analysis:
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
                filters_hash=filters_hash,
            )
        )
        session.commit()
        return result

    return wrapper


async def clear_cache(session: Session) -> int:
    """Clear cache entries from database."""
    scraped = session.query(ScrapedItem).delete()
    analyzed = session.query(AnalysisResult).delete()
    session.commit()
    count = scraped + analyzed
    log.debug("Cache entries cleared", count=count)
    return count
