import contextlib
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.ext.asyncio import (
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import declarative_base

from backend.common.logging import log

DB_PATH = "data/cache.db"
DB_URL = f"sqlite+aiosqlite:///{DB_PATH}"


class DatabaseSessionManager:
    def __init__(self, db_url: str):
        self._engine = create_async_engine(db_url)
        self._sessionmaker = async_sessionmaker(
            autocommit=False, bind=self._engine
        )  # ty: ignore[no-matching-overload]

    async def close(self):
        if self._engine is not None:
            await self._engine.dispose()
            self._engine = None
            self._sessionmaker = None

    @contextlib.asynccontextmanager
    async def connect(self):
        if self._engine is None:
            raise Exception("DatabaseSessionManager is not initialized")
        async with self._engine.begin() as connection:
            try:
                yield connection
            except Exception:
                await connection.rollback()
                raise

    @contextlib.asynccontextmanager
    async def session(self):
        if self._sessionmaker is None:
            raise Exception("DatabaseSessionManager is not initialized")
        session = self._sessionmaker()
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


sessionmanager = DatabaseSessionManager(DB_URL)

Base = declarative_base()


class ScrapedItem(Base):
    __tablename__ = "scraped_items"
    id = Column(Integer, primary_key=True, autoincrement=True)
    platform = Column(String, nullable=False)
    url = Column(String, nullable=False)
    max_images = Column(Integer, nullable=False, default=1)
    item = Column(JSON, nullable=False)
    created = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    __table_args__ = (
        UniqueConstraint("platform", "url", "max_images", name="_platform_url_images_uc"),
    )


class AnalysisResult(Base):
    __tablename__ = "analysis_results"
    id = Column(Integer, primary_key=True, autoincrement=True)
    platform = Column(String, nullable=False)
    url = Column(String, nullable=False)
    filters = Column(JSON, nullable=False)
    filters_hash = Column(String, nullable=False)
    max_images = Column(Integer, nullable=False, default=1)
    created = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    __table_args__ = (
        UniqueConstraint(
            "platform",
            "url",
            "filters_hash",
            "max_images",
            name="_platform_url_filters_images_uc",
        ),
    )


async def init_db() -> None:
    async with sessionmanager.connect() as conn:
        await conn.run_sync(Base.metadata.create_all)
    log.info("Database initialized", db_path=DB_URL)
