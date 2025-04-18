from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import BaseModel

from backend.analyzer.models import Product, ProductFilter
from backend.analyzer.processor import ProductAnalyzer


@pytest.fixture
def mock_product():
    """Create a mock Product for testing."""
    product = Product(
        url="https://www.leboncoin.fr/ad/instruments_de_musique/1234567890",
        title="Guitare acoustique en parfait état",
        description="Guitare acoustique de marque Martin, achetée il y a 2 ans, très peu utilisée.",
    )
    product.id = 1234567890
    product.vendor = "leboncoin"
    product.filters = [
        ProductFilter(description="No visible damage"),
        ProductFilter(description="Original packaging included"),
    ]
    return product


def test_product_filter_initialization():
    """Test that ProductFilter correctly initializes and transforms names."""
    filter1 = ProductFilter(description="No visible damage")
    filter2 = ProductFilter(description="Original packaging included")

    assert filter1.name == "no_visible_damage"
    assert filter2.name == "original_packaging_included"
    assert filter1.value is None
    assert filter2.value is None


def test_product_matches_filters():
    """Test the matches_filters property of Product."""
    product = Product(
        url="https://example.com/product/123",
        title="Test Product",
        description="A test product",
    )

    # No filters - should match
    assert product.matches_filters is True

    # Add filters - all set to True
    product.filters = [
        ProductFilter(description="Filter 1"),
        ProductFilter(description="Filter 2"),
    ]
    product.filters[0].value = True
    product.filters[1].value = True
    assert product.matches_filters is True

    # One filter set to False
    product.filters[1].value = False
    assert product.matches_filters is False


def test_product_matches_min_filters():
    """Test the matches_min_filters method of Product."""
    product = Product(
        url="https://example.com/product/123",
        title="Test Product",
        description="A test product",
    )

    # No filters - should match any min count
    assert product.matches_min_filters(1) is True

    # Add filters - two out of three match
    product.filters = [
        ProductFilter(description="Filter 1"),
        ProductFilter(description="Filter 2"),
        ProductFilter(description="Filter 3"),
    ]
    product.filters[0].value = True
    product.filters[1].value = True
    product.filters[2].value = False

    assert product.matches_min_filters(1) is True
    assert product.matches_min_filters(2) is True
    assert product.matches_min_filters(3) is False


@patch("backend.analyzer.processor.settings")
def test_analyzer_initialization(mock_settings):
    """Test ProductAnalyzer initialization."""
    # Test API-based initialization
    mock_settings.use_local_model = False
    mock_settings.model_name = "test-model"
    mock_settings.openai_api_key = "test-key"

    with patch(
        "backend.analyzer.processor.ProductAnalyzer._create_openai_model"
    ) as mock_create_openai:
        analyzer = ProductAnalyzer(use_local=False)
        assert analyzer.predict == analyzer._predict_openai
        mock_create_openai.assert_called_once()

    # Test local model initialization
    mock_settings.use_local_model = True
    mock_settings.local_model_name = "test-local-model"

    with patch(
        "backend.analyzer.processor.ProductAnalyzer._create_local_model"
    ) as mock_create_local:
        with patch.dict(
            "sys.modules",
            {
                "outlines": MagicMock(),
                "torch": MagicMock(),
                "transformers": MagicMock(),
            },
        ):
            analyzer = ProductAnalyzer(use_local=True)
            assert analyzer.predict == analyzer._predict_local
            mock_create_local.assert_called_once()


def test_create_filter_schema():
    """Test the creation of dynamic filter schemas."""
    filters = [
        ProductFilter(description="No visible damage"),
        ProductFilter(description="Original packaging included"),
    ]

    schema = ProductAnalyzer._create_filter_schema(filters)

    assert issubclass(schema, BaseModel)
    assert "no_visible_damage" in schema.model_fields
    assert "original_packaging_included" in schema.model_fields


@pytest.mark.asyncio
async def test_analyze_product(mock_product):
    """Test the analyze_product method."""
    # Setup the analyzer with a mock predict method
    analyzer = ProductAnalyzer()

    # Create a response object that matches the schema
    class DummySchema(BaseModel):
        no_visible_damage: bool = True
        original_packaging_included: bool = False

    # Set up the mock predict method
    analyzer.predict = AsyncMock(return_value=DummySchema())

    # Call the method
    result = await analyzer.analyze_product(mock_product)

    # Check the filter values were set
    assert result.filters[0].value is True
    assert result.filters[1].value is False

    # Check that predict was called with the right arguments
    analyzer.predict.assert_called_once()


if __name__ == "__main__":
    pytest.main()
