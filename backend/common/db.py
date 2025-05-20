import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from backend.common.logging import log

DB_PATH = "data/cache.db"
ASYNC_DB_URL = f"sqlite+aiosqlite:///{DB_PATH}"

async_engine = create_async_engine(
    ASYNC_DB_URL, connect_args={"check_same_thread": False}, echo=False
)
AsyncSessionLocal = sessionmaker(bind=async_engine, class_=AsyncSession, expire_on_commit=False)
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
    item = Column(JSON, nullable=False)
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
    db_dir = os.path.dirname(DB_PATH)
    if db_dir:
        Path(db_dir).mkdir(parents=True, exist_ok=True)
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    log.info("Database initialized", db_path=DB_PATH)


@asynccontextmanager
async def get_async_session_context():
    session = AsyncSessionLocal()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()
