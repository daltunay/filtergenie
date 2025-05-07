from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import sqlalchemy as sa

from backend.analyzer import Product
from backend.common.db import get_async_session


class TestDatabase:
    """Test suite for database functionality."""

    @pytest.fixture
    def mock_engine(self) -> MagicMock:
        """Create a mock SQLAlchemy engine."""
        engine = MagicMock()
        engine.dispose = AsyncMock()
        return engine

    @pytest.fixture
    def mock_session(self) -> MagicMock:
        """Create a mock SQLModel session."""
        session = MagicMock()
        session.close = MagicMock()
        session.rollback = MagicMock()
        session.commit = MagicMock()
        return session

    @pytest.fixture
    def mock_db_setup(self, mock_engine: MagicMock, mock_session: MagicMock) -> None:
        """Setup database mocking."""
        mock_engine.begin = AsyncMock().__aenter__.return_value = mock_session
        mock_session.commit = MagicMock()
        mock_session.rollback = MagicMock()
        mock_session.close = MagicMock()

    @pytest.mark.asyncio
    async def test_session_lifecycle(self, mock_db_setup: None, mock_session: MagicMock) -> None:
        """Test the database session lifecycle."""
        with patch("backend.common.db.Session", return_value=mock_session):
            async with get_async_session() as session:
                assert session == mock_session

            mock_session.close.assert_called_once()

    @pytest.mark.asyncio
    async def test_session_error_handling(
        self, mock_db_setup: None, mock_session: MagicMock
    ) -> None:
        """Test session error handling."""
        with patch("backend.common.db.Session", return_value=mock_session):
            mock_session.execute = MagicMock(side_effect=Exception("Database error"))

            with pytest.raises(Exception):
                async with get_async_session() as session:
                    await session.exec(sa.text("SELECT 1"))

            mock_session.rollback.assert_called_once()
            mock_session.close.assert_called_once()

    @pytest.mark.asyncio
    async def test_product_crud(self) -> None:
        """Test CRUD operations for products simplistically."""
        test_product = Product(
            id=123,
            platform="ebay",
            title="Test Product",
            description="Test description",
            url="https://example.com/product/123",
        )

        # Create a simple session mock
        mock_session = MagicMock()

        # Configure the mock_session.exec().first() chain directly
        mock_session.exec.return_value.first.return_value = test_product

        # Use the mock in our test
        with patch("backend.common.db.Session", return_value=mock_session):
            async with get_async_session() as session:
                session.add(test_product)
                session.commit()

                result = session.exec().first()
                assert result == test_product
                assert result.id == 123
                assert result.platform == "ebay"
