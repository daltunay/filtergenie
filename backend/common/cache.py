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
        async def wrapper(
            session: Session,
            platform: str,
            url: str,
            html: str,
            max_images: int,
            *args,
            **kwargs,
        ):
            item = (
                session.query(ScrapedItem)
                .filter(
                    ScrapedItem.platform == platform,
                    ScrapedItem.url == url,
                    ScrapedItem.max_images >= max_images,
                )
                .order_by(ScrapedItem.max_images.asc())
                .first()
            )
            if item:
                log.debug(
                    "Scrape cache hit",
                    platform=platform,
                    url=url,
                    max_images=max_images,
                )
                return scrape_func(platform=platform, url=url, html=item.html)
            log.debug(
                "Scrape cache miss",
                platform=platform,
                url=url,
                max_images=max_images,
            )
            result = await func(session, platform, url, html, max_images, *args, **kwargs)
            session.add(ScrapedItem(platform=platform, url=url, html=html, max_images=max_images))
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
        max_images: int,
        *args,
        **kwargs,
    ) -> list[FilterModel]:
        platform = item.platform
        url = item.url
        filters_json = json.dumps([f.desc for f in filters], sort_keys=True)
        filters_hash = hashlib.sha256(filters_json.encode("utf-8")).hexdigest()
        analysis = (
            session.query(AnalysisResult)
            .filter(
                AnalysisResult.platform == platform,
                AnalysisResult.url == url,
                AnalysisResult.filters_hash == filters_hash,
                AnalysisResult.max_images >= max_images,
            )
            .order_by(AnalysisResult.max_images.asc())
            .first()
        )
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
        result = await func(session, analyzer, item, filters, max_images, *args, **kwargs)
        session.add(
            AnalysisResult(
                platform=platform,
                url=url,
                item=item.model_dump(),
                filters=[f.model_dump() for f in result],
                filters_hash=filters_hash,
                max_images=max_images,
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
