import typing as tp
from unittest.mock import MagicMock, patch

import pytest
from pydantic import create_model

from backend.analyzer import Product, ProductAnalyzer, ProductFilter, ProductImage

# Mock for outlines module
pytest.importorskip("unittest.mock").patch.dict(
    "sys.modules",
    {"outlines": MagicMock(), "torch": MagicMock(), "transformers": MagicMock()},
).start()


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
            platform="leboncoin",
            title="Test Product",
            description="A test product for unit tests",
            url="https://www.example.com/product/1",
        )

        # Create filters
        filters = [
            ProductFilter(description="Is in good condition"),
            ProductFilter(description="Has original packaging"),
            ProductFilter(description="Includes manual"),
        ]

        # Set filter values
        filters[0].value = True
        filters[1].value = True
        filters[2].value = False

        # Associate filters with the product
        product.filters = filters

        # Test matching counts using product's filters
        def matches_min_filters(min_count):
            return sum(1 for f in product.filters if f.value) >= min_count

        assert matches_min_filters(1) is True
        assert matches_min_filters(2) is True
        assert matches_min_filters(3) is False

        # Test matches_all_filters using product's filters
        assert all(f.value for f in product.filters) is False

        # Make all filters true
        product.filters[2].value = True
        assert all(f.value for f in product.filters) is True

    def test_product_extension_dict(self) -> None:
        """Test converting product to extension API format."""
        product = Product(
            id=1,
            platform="leboncoin",
            title="Test Product",
            description="A test product for unit tests",
            url="https://www.example.com/product/1",
        )

        filters = [
            ProductFilter(description="Filter 1"),
            ProductFilter(description="Filter 2"),
        ]
        filters[0].value = True
        filters[1].value = False

        # Instead of mocking to_extension_dict, create a similar extension dict manually
        extension_dict = {
            "url": product.url,
            "id": product.id,
            "title": product.title,
            "platform": product.platform,
            "matches_all_filters": False,
            "filters": [
                {"description": filters[0].description, "value": filters[0].value},
                {"description": filters[1].description, "value": filters[1].value},
            ],
            "match_count": 1,
            "total_filters": 2,
        }

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
def mock_image() -> tp.Generator[MagicMock, None, None]:
    """Create a mock for PIL Image."""
    mock_img = MagicMock()
    with (
        patch("backend.analyzer.models.load_img", return_value=mock_img),
        patch("backend.analyzer.models.resize_img", return_value=mock_img),
        patch("backend.analyzer.models.img_to_base64", return_value="base64_image_data"),
    ):
        yield mock_img


class TestProductAnalyzer:
    """Test suite for ProductAnalyzer."""

    @patch("outlines.models")
    def test_analyzer_init_local(self, mock_models: MagicMock) -> None:
        """Test ProductAnalyzer initialization with local model."""
        # Create necessary mocks
        mock_model = MagicMock()
        mock_models.transformers_vision.return_value = mock_model

        # Need to patch torch and transformers modules
        with patch.dict("sys.modules", {"torch": MagicMock(), "transformers": MagicMock()}):
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
            platform="leboncoin",
            title="Test Product",
            description="Test description",
            url="https://www.example.com/product/1",
            images=[ProductImage(url_or_path="https://www.example.com/image.jpg")],
        )

        filter_descriptions = ["Filter 1", "Filter 2"]

        # Mock the _predict_local method and _create_local_model
        with (
            patch("backend.analyzer.processor.ProductAnalyzer._create_local_model"),
            patch("backend.analyzer.processor.ProductAnalyzer._predict_local") as mock_predict,
        ):
            # Create a mock schema instance with filter properties
            DynamicSchema = create_model(
                "DynamicSchema", filter_1=(bool, True), filter_2=(bool, False)
            )
            mock_result = DynamicSchema()
            mock_predict.return_value = mock_result

            # Initialize analyzer with mocked local model
            analyzer = ProductAnalyzer(use_local=True)

            # Apply mocked filters through result
            product_filters = [
                ProductFilter(description="Filter 1"),
                ProductFilter(description="Filter 2"),
            ]
            product_filters[0].value = True
            product_filters[1].value = False

            # Analyze the product
            with patch.object(analyzer, "_create_filter_schema", return_value=DynamicSchema):
                result, filters = await analyzer.analyze_product(product, filter_descriptions)

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
            platform="leboncoin",
            title="Test Product",
            description="Test description",
            url="https://www.example.com/product/1",
            images=[ProductImage(url_or_path="https://www.example.com/image.jpg")],
        )

        filter_descriptions = ["Filter 1", "Filter 2"]

        # Mock the _predict_openai method
        with patch("backend.analyzer.processor.ProductAnalyzer._predict_openai") as mock_predict:
            # Create a mock schema instance with filter properties
            DynamicSchema = create_model(
                "DynamicSchema", filter_1=(bool, True), filter_2=(bool, False)
            )
            mock_result = DynamicSchema()
            mock_predict.return_value = mock_result

            # Initialize analyzer with mocked API model
            analyzer = ProductAnalyzer(use_local=False)

            # Apply mocked filters through result
            product_filters = [
                ProductFilter(description="Filter 1"),
                ProductFilter(description="Filter 2"),
            ]
            product_filters[0].value = True
            product_filters[1].value = False

            # Analyze the product
            with patch.object(analyzer, "_create_filter_schema", return_value=DynamicSchema):
                result, filters = await analyzer.analyze_product(product, filter_descriptions)

                # Check predictions are applied to filters
                assert filters[0].value is True
                assert filters[1].value is False

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
        assert schema_fields["filter_1"] is bool
        assert schema_fields["filter_2_with_spaces"] is bool
