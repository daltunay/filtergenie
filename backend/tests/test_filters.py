from backend.analyzer import Product, ProductFilter
from backend.analyzer.models import ProductImage


class TestFilters:
    """Test suite for filter functionality."""

    def test_filter_creation(self) -> None:
        """Test creating filters with various descriptions."""
        # Simple filter
        filter1 = ProductFilter(description="Has no scratches")
        assert filter1.description == "Has no scratches"
        assert filter1.value is None
        assert filter1.name == "has_no_scratches"

        # Filter with special characters
        filter2 = ProductFilter(description="Includes box & manual (100%)")
        assert filter2.name == "includes_box_manual_100"

        # Empty filter should still work
        filter3 = ProductFilter(description="")
        assert filter3.name == ""

    def test_filter_equality(self) -> None:
        """Test filter equality comparison."""
        filter1 = ProductFilter(description="Same filter")
        filter2 = ProductFilter(description="Same filter")
        filter3 = ProductFilter(description="Different filter")

        # Filters with same description should be considered equal
        assert filter1 == filter2
        assert filter1 != filter3

        # Value changes should not affect equality
        filter1.value = True
        filter2.value = False
        assert filter1 == filter2  # Still equal based on description

    def test_filter_serialization(self) -> None:
        """Test filter serialization to dict."""
        filter1 = ProductFilter(description="Test filter")
        filter1.value = True

        filter_dict = filter1.model_dump()  # Changed from dict() to model_dump()
        assert filter_dict["description"] == "Test filter"
        assert filter_dict["value"] is True
        assert filter_dict["name"] == "test_filter"

    def test_product_matching_logic(self) -> None:
        """Test product filter matching logic."""
        # Create a test product with filters
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

        # Associate filters with product
        product.filters = filters

        # Test matching counts - using the product's filters
        matching_filters = [f for f in product.filters if f.value]
        assert len(matching_filters) == 2
        assert len(product.filters) == 3

        # Test matches_all_filters
        assert all(f.value for f in product.filters) is False

        # Make all filters true
        filters[2].value = True
        assert all(f.value for f in product.filters) is True

    def test_filter_application_to_product(self) -> None:
        """Test applying filters to a product."""
        # Create test product
        product = Product(
            id=123,
            platform="ebay",  # Changed from "test" to "ebay"
            title="Test Product",
            description="A product for testing",
            url="https://www.example.com/product/123",
            images=[ProductImage(url_or_path="https://www.example.com/image.jpg")],
        )

        # Create and apply filters
        filters = [
            ProductFilter(description="Is electronic"),
            ProductFilter(description="Has warranty"),
            ProductFilter(description="Is used"),
        ]

        # Set filter values and associate them with the product
        filters[0].value = True  # Passes
        filters[1].value = False  # Fails
        filters[2].value = True  # Passes
        product.filters = filters

        # Test direct filter status from the product
        passing_filters = [f for f in product.filters if f.value]
        failing_filters = [f for f in product.filters if f.value is False]

        assert len(passing_filters) == 2
        assert len(failing_filters) == 1
        assert passing_filters[0].description == "Is electronic"
        assert failing_filters[0].description == "Has warranty"

        # Test matching logic with product's filters
        assert len([f for f in product.filters if f.value]) == 2
        assert all(f.value for f in product.filters) is False  # Not all pass
        assert any(f.value for f in product.filters) is True  # At least one passes

        # Test product filter match rate
        match_rate = sum(1 for f in product.filters if f.value) / len(product.filters)
        assert match_rate == 2 / 3

    def test_filter_name_normalization(self) -> None:
        """Test normalization of filter names."""
        test_cases = [
            ("Normal case", "normal_case"),
            ("UPPERCASE", "uppercase"),
            ("with-hyphens", "with_hyphens"),
            ("   extra spaces   ", "extra_spaces"),
            ("special!@#$%^&*characters", "special_characters"),
            ("numbers123", "numbers123"),
            ("", ""),  # Empty case
        ]

        for input_desc, expected_name in test_cases:
            filter_obj = ProductFilter(description=input_desc)
            assert filter_obj.name == expected_name, f"Failed for: {input_desc}"
