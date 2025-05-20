import asyncio

from sqlalchemy.orm import Session

from backend.analyzer.engine import Analyzer
from backend.analyzer.models import FilterModel, ItemModel
from backend.common.cache import analyze_cache, clear_cache, scrape_cache
from backend.common.db import AnalysisResult, ScrapedItem, get_session_context, init_db
from backend.scraper import scrape_item


class DummyAnalyzer:
    async def analyze_item(self, item: ItemModel, filters: list[FilterModel]) -> list[FilterModel]:
        for f in filters:
            f.value = True
        return filters


@scrape_cache(scrape_item)
async def cached_scrape_item(
    session: Session,
    platform: str,
    url: str,
    html: str,
    max_images: int = 1,
) -> ItemModel:
    return ItemModel(platform=platform, url=url, title="Test", images=[])


@analyze_cache
async def cached_analyze_item(
    session: Session,
    analyzer: Analyzer,
    item: ItemModel,
    filters: list[FilterModel],
    max_images: int = 1,
) -> list[FilterModel]:
    return await analyzer.analyze_item(item, filters)


def test_db_and_cache(tmp_path):
    from backend.common import db

    db.DB_PATH = str(tmp_path / "test_cache.db")
    db.DB_URL = f"sqlite:///{db.DB_PATH}"
    db.engine = db.create_engine(db.DB_URL, connect_args={"check_same_thread": False}, echo=False)
    db.SessionLocal = db.sessionmaker(
        bind=db.engine, expire_on_commit=False
    )  # ty: ignore[no-matching-overload]
    db.Base.metadata.create_all(db.engine)

    init_db()
    with get_session_context() as session:
        item1 = asyncio.run(
            cached_scrape_item(session, "vinted", "http://item1", "<html>foo</html>", max_images=1)
        )
        assert item1.platform == "vinted"
        item2 = asyncio.run(
            cached_scrape_item(session, "vinted", "http://item1", "<html>bar</html>", max_images=1)
        )
        assert item2.platform == "vinted"
        assert session.query(ScrapedItem).count() == 1

        analyzer = DummyAnalyzer()
        filters = [FilterModel(desc="Red"), FilterModel(desc="Large")]
        result1 = asyncio.run(cached_analyze_item(session, analyzer, item1, filters, max_images=1))
        assert all(f.value for f in result1)
        result2 = asyncio.run(cached_analyze_item(session, analyzer, item1, filters, max_images=1))
        assert all(f.value for f in result2)
        assert session.query(AnalysisResult).count() == 1

        cleared = asyncio.run(clear_cache(session))
        assert cleared == 2
        assert session.query(ScrapedItem).count() == 0
        assert session.query(AnalysisResult).count() == 0


def test_duplicate_scraped_item(tmp_path):
    from backend.common import db

    db.DB_PATH = str(tmp_path / "test_dup_scrape.db")
    db.DB_URL = f"sqlite:///{db.DB_PATH}"
    db.engine = db.create_engine(db.DB_URL, connect_args={"check_same_thread": False}, echo=False)
    db.SessionLocal = db.sessionmaker(
        bind=db.engine, expire_on_commit=False
    )  # ty: ignore[no-matching-overload]
    db.Base.metadata.create_all(db.engine)
    init_db()
    with get_session_context() as session:
        _ = asyncio.run(
            cached_scrape_item(session, "vinted", "http://item1", "<html>foo</html>", max_images=1)
        )
        _ = asyncio.run(
            cached_scrape_item(session, "vinted", "http://item1", "<html>bar</html>", max_images=1)
        )
        assert session.query(ScrapedItem).count() == 1


def test_duplicate_analysis_result(tmp_path):
    from backend.common import db

    db.DB_PATH = str(tmp_path / "test_dup_analysis.db")
    db.DB_URL = f"sqlite:///{db.DB_PATH}"
    db.engine = db.create_engine(db.DB_URL, connect_args={"check_same_thread": False}, echo=False)
    db.SessionLocal = db.sessionmaker(
        bind=db.engine, expire_on_commit=False
    )  # ty: ignore[no-matching-overload]
    db.Base.metadata.create_all(db.engine)
    init_db()
    with get_session_context() as session:
        item = asyncio.run(
            cached_scrape_item(session, "vinted", "http://item2", "<html>foo</html>", max_images=1)
        )
        analyzer = DummyAnalyzer()
        filters = [FilterModel(desc="Red"), FilterModel(desc="Large")]
        _ = asyncio.run(cached_analyze_item(session, analyzer, item, filters, max_images=1))
        _ = asyncio.run(cached_analyze_item(session, analyzer, item, filters, max_images=1))
        assert session.query(AnalysisResult).count() == 1


def test_analysis_result_different_filters(tmp_path):
    from backend.common import db

    db.DB_PATH = str(tmp_path / "test_diff_filters.db")
    db.DB_URL = f"sqlite:///{db.DB_PATH}"
    db.engine = db.create_engine(db.DB_URL, connect_args={"check_same_thread": False}, echo=False)
    db.SessionLocal = db.sessionmaker(
        bind=db.engine, expire_on_commit=False
    )  # ty: ignore[no-matching-overload]
    db.Base.metadata.create_all(db.engine)
    init_db()
    with get_session_context() as session:
        item = asyncio.run(
            cached_scrape_item(session, "vinted", "http://item3", "<html>foo</html>", max_images=1)
        )
        analyzer = DummyAnalyzer()
        filters1 = [FilterModel(desc="Red")]
        filters2 = [FilterModel(desc="Large")]
        asyncio.run(cached_analyze_item(session, analyzer, item, filters1, max_images=1))
        asyncio.run(cached_analyze_item(session, analyzer, item, filters2, max_images=1))
        assert session.query(AnalysisResult).count() == 2


def test_session_rollback_on_error(tmp_path):
    from backend.common import db

    db.DB_PATH = str(tmp_path / "test_rollback.db")
    db.DB_URL = f"sqlite:///{db.DB_PATH}"
    db.engine = db.create_engine(db.DB_URL, connect_args={"check_same_thread": False}, echo=False)
    db.SessionLocal = db.sessionmaker(
        bind=db.engine, expire_on_commit=False
    )  # ty: ignore[no-matching-overload]
    db.Base.metadata.create_all(db.engine)
    init_db()
    try:
        with get_session_context() as session:
            session.add(ScrapedItem(platform="vinted", url="http://item4", html="<html>foo</html>"))
            raise RuntimeError("Simulated error")
    except RuntimeError:
        pass
    with get_session_context() as session:
        assert session.query(ScrapedItem).count() == 0


def test_cache_persists_across_sessions(tmp_path):
    from backend.common import db

    db.DB_PATH = str(tmp_path / "test_persist.db")
    db.DB_URL = f"sqlite:///{db.DB_PATH}"
    db.engine = db.create_engine(db.DB_URL, connect_args={"check_same_thread": False}, echo=False)
    db.SessionLocal = db.sessionmaker(
        bind=db.engine, expire_on_commit=False
    )  # ty: ignore[no-matching-overload]
    db.Base.metadata.create_all(db.engine)
    init_db()
    with get_session_context() as session:
        item = asyncio.run(
            cached_scrape_item(session, "vinted", "http://item5", "<html>foo</html>", max_images=1)
        )
        analyzer = DummyAnalyzer()
        filters = [FilterModel(desc="Red")]
        asyncio.run(cached_analyze_item(session, analyzer, item, filters, max_images=1))
    with get_session_context() as session:
        assert session.query(ScrapedItem).count() == 1
        assert session.query(AnalysisResult).count() == 1
