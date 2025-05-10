import os
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    Integer,
    String,
    Text,
    UniqueConstraint,
    create_engine,
)
from sqlalchemy.orm import declarative_base, sessionmaker

from backend.common.logging import log
from backend.config import settings

DB_PATH = settings.cache.db_path
DB_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DB_URL, connect_args={"check_same_thread": False}, echo=False)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)  # ty: ignore[no-matching-overload]
Base = declarative_base()


class ScrapedItem(Base):
    __tablename__ = "scraped_items"
    id = Column(Integer, primary_key=True, autoincrement=True)
    platform = Column(String, nullable=False)
    url = Column(String, nullable=False)
    html = Column(Text, nullable=False)
    created = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    __table_args__ = (UniqueConstraint("platform", "url", name="_platform_url_uc"),)


class AnalysisResult(Base):
    __tablename__ = "analysis_results"
    id = Column(Integer, primary_key=True, autoincrement=True)
    platform = Column(String, nullable=False)
    url = Column(String, nullable=False)
    item = Column(JSON, nullable=False)
    filters = Column(JSON, nullable=False)
    created = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    __table_args__ = (UniqueConstraint("platform", "url", name="_platform_url_analysis_uc"),)


def init_db() -> None:
    db_dir = os.path.dirname(DB_PATH)
    if db_dir:
        Path(db_dir).mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(engine)
    log.info("Database initialized", db_path=DB_PATH)


@contextmanager
def get_session_context():
    session = SessionLocal()
    try:
        yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
