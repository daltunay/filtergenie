from unittest.mock import MagicMock, patch

import pytest
from pydantic import create_model

from backend.analyzer import Product, ProductAnalyzer, ProductFilter, ProductImage


class TestProductModels:
    """Test suite for Product-related models."""

    def test_product_filter_initialization(self) -> None:
        """Test ProductFilter initialization and name generation."""
        filter_desc = "Has no visible scratches"
        filter_obj = ProductFilter(description=filter_desc)

        assert filter_obj.description == filter_desc
        assert filter_obj.value is None
        assert filter_obj.name == "has_no_visible_scratches"  # Sanitized name

        # Test with special characters
        special_desc = "Contains 100% original packaging!"
        special_filter = ProductFilter(description=special_desc)
        assert special_filter.name == "contains_100_original_packaging"

    def test_product_matching_logic(self) -> None:
        """Test product filter matching logic."""
        product = Product(
            id=1,
            vendor="leboncoin",
            title="Test Product",
            description="A test product for unit tests",
            url="https://www.example.com/product/1",
        )

        # Add filters with different values
        product.filters = [
            ProductFilter(description="Is in good condition"),
            ProductFilter(description="Has original packaging"),
            ProductFilter(description="Includes manual"),
        ]

        # Set filter values
        product.filters[0].value = True
        product.filters[1].value = True
        product.filters[2].value = False

        # Test matching counts
        assert product.matches_min_filters(1) is True
        assert product.matches_min_filters(2) is True
        assert product.matches_min_filters(3) is False

        # Test matches_all_filters property
        assert product.matches_all_filters is False

        # Make all filters true
        product.filters[2].value = True
        assert product.matches_all_filters is True

    def test_product_extension_dict(self) -> None:
        """Test converting product to extension API format."""
        product = Product(
            id=1,
            vendor="leboncoin",
            title="Test Product",
            description="A test product for unit tests",
            url="https://www.example.com/product/1",
        )

        product.filters = [
            ProductFilter(description="Filter 1"),
            ProductFilter(description="Filter 2"),
        ]

        product.filters[0].value = True
        product.filters[1].value = False

        extension_dict = product.to_extension_dict()

        assert extension_dict["url"] == product.url
        assert extension_dict["id"] == product.id
        assert extension_dict["title"] == product.title
        assert extension_dict["matches_all_filters"] is False
        assert extension_dict["match_count"] == 1
        assert extension_dict["total_filters"] == 2
        assert len(extension_dict["filters"]) == 2
        assert extension_dict["filters"][0]["description"] == "Filter 1"
        assert extension_dict["filters"][0]["value"] is True
        assert extension_dict["filters"][1]["value"] is False


@pytest.fixture
def mock_image() -> MagicMock:
    """Create a mock for PIL Image."""
    mock_img = MagicMock()
    with patch("backend.analyzer.models.load_img", return_value=mock_img), patch(
        "backend.analyzer.models.resize_img", return_value=mock_img
    ), patch("backend.analyzer.models.img_to_base64", return_value="base64_image_data"):
        yield mock_img


class TestProductAnalyzer:
    """Test suite for ProductAnalyzer."""

    @patch("outlines.models")
    def test_analyzer_init_local(self, mock_models: MagicMock) -> None:
        """Test ProductAnalyzer initialization with local model."""
        mock_model = MagicMock()
        mock_models.transformers_vision.return_value = mock_model

        analyzer = ProductAnalyzer(use_local=True)

        assert analyzer.model == mock_model
        mock_models.transformers_vision.assert_called_once()

    @patch("openai.AsyncOpenAI")
    def test_analyzer_init_api(self, mock_openai: MagicMock) -> None:
        """Test ProductAnalyzer initialization with API model."""
        mock_client = MagicMock()
        mock_openai.return_value = mock_client

        analyzer = ProductAnalyzer(use_local=False)

        assert analyzer.model == mock_client
        mock_openai.assert_called_once()

    @pytest.mark.asyncio
    async def test_analyze_product_local(self, mock_image: MagicMock) -> None:
        """Test product analysis with local model."""
        # Create a product with filters
        product = Product(
            id=1,
            vendor="leboncoin",
            title="Test Product",
            description="Test description",
            url="https://www.example.com/product/1",
            images=[ProductImage(url_or_path="https://www.example.com/image.jpg")],
            filters=[
                ProductFilter(description="Filter 1"),
                ProductFilter(description="Filter 2"),
            ],
        )

        # Mock the _predict_local method
        with patch(
            "backend.analyzer.processor.ProductAnalyzer._predict_local"
        ) as mock_predict:
            # Create a mock schema instance with filter properties
            DynamicSchema = create_model(
                "DynamicSchema", filter_1=(bool, True), filter_2=(bool, False)
            )
            mock_result = DynamicSchema()
            mock_predict.return_value = mock_result

            # Initialize analyzer with mocked local model
            analyzer = ProductAnalyzer(use_local=True)

            # Analyze the product
            result = await analyzer.analyze_product(product)

            # Check predictions are applied to filters
            assert result.filters[0].value is True
            assert result.filters[1].value is False

            # Check the mock was called with expected arguments
            mock_predict.assert_called_once()
            args = mock_predict.call_args[0]
            assert "Test Product" in args[0]  # Prompt contains title
            assert "Test description" in args[0]  # Prompt contains description
            assert len(args[1]) == 1  # One image

    @pytest.mark.asyncio
    async def test_analyze_product_api(self, mock_image: MagicMock) -> None:
        """Test product analysis with API model."""
        # Create a product with filters
        product = Product(
            id=1,
            vendor="leboncoin",
            title="Test Product",
            description="Test description",
            url="https://www.example.com/product/1",
            images=[ProductImage(url_or_path="https://www.example.com/image.jpg")],
            filters=[
                ProductFilter(description="Filter 1"),
                ProductFilter(description="Filter 2"),
            ],
        )

        # Mock the _predict_openai method
        with patch(
            "backend.analyzer.processor.ProductAnalyzer._predict_openai"
        ) as mock_predict:
            # Create a mock schema instance with filter properties
            DynamicSchema = create_model(
                "DynamicSchema", filter_1=(bool, True), filter_2=(bool, False)
            )
            mock_result = DynamicSchema()
            mock_predict.return_value = mock_result

            # Initialize analyzer with mocked API model
            analyzer = ProductAnalyzer(use_local=False)

            # Analyze the product
            result = await analyzer.analyze_product(product)

            # Check predictions are applied to filters
            assert result.filters[0].value is True
            assert result.filters[1].value is False

            # Check the mock was called with expected arguments
            mock_predict.assert_called_once()

    def test_create_filter_schema(self) -> None:
        """Test dynamic schema creation based on filters."""
        filters = [
            ProductFilter(description="Filter 1"),
            ProductFilter(description="Filter 2 with spaces"),
        ]

        analyzer = ProductAnalyzer(use_local=False)
        schema = analyzer._create_filter_schema(filters)

        # Check schema has the right fields
        schema_fields = schema.__annotations__
        assert "filter_1" in schema_fields
        assert "filter_2_with_spaces" in schema_fields
        assert schema_fields["filter_1"] == bool
        assert schema_fields["filter_2_with_spaces"] == bool
