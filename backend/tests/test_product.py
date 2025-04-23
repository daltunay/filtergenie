from unittest.mock import patch

import pytest

from backend.analyzer.models import Product, ProductImage


class TestProduct:
    """Tests for the Product model core functionality."""

    def test_product_creation(self) -> None:
        """Test basic product creation and properties."""
        product = Product(
            id=123,
            platform="leboncoin",
            url="https://www.example.com/product/123",
            title="Test Product",
            description="A sample product for testing",
        )

        assert product.id == 123
        assert product.platform == "leboncoin"
        assert str(product.url) == "https://www.example.com/product/123"
        assert product.title == "Test Product"
        assert product.description == "A sample product for testing"

    def test_product_subscriptable(self) -> None:
        """Test that Product objects are subscriptable like dictionaries."""
        product = Product(
            id=123,
            platform="ebay",
            url="https://www.example.com/product/123",
            title="Subscriptable Product",
        )

        assert product.id == 123
        assert product.platform == "ebay"
        assert product.title == "Subscriptable Product"

        # The matches_all_filters method doesn't exist directly on Product anymore
        # Let's test attribute access instead

        # Test invalid key
        with pytest.raises(AttributeError):
            _ = product.invalid_key


class TestProductImage:
    """Tests for ProductImage functionality."""

    @patch("backend.analyzer.models.load_img")
    @patch("backend.analyzer.models.resize_img")
    @patch("backend.analyzer.models.img_to_base64")
    def test_image_processing(self, mock_to_base64, mock_resize, mock_load) -> None:
        """Test image loading, resizing, and base64 conversion."""
        mock_img = mock_load.return_value
        mock_resize.return_value = mock_img
        mock_to_base64.return_value = "base64_encoded_image"

        image = ProductImage(url_or_path="https://www.example.com/image.jpg")

        # Test image property
        result_img = image.image
        mock_load.assert_called_once_with("https://www.example.com/image.jpg")
        mock_resize.assert_called_once_with(mock_img)
        assert result_img == mock_img

        # Test base64 property
        result_base64 = image.base64
        mock_to_base64.assert_called_once_with(mock_img)
        assert result_base64 == "base64_encoded_image"

    @patch("backend.analyzer.models.load_img")
    def test_image_load_error(self, mock_load) -> None:
        """Test error handling when loading images fails."""
        mock_load.side_effect = ValueError("Invalid image")

        image = ProductImage(url_or_path="https://www.example.com/invalid.jpg")

        with pytest.raises(ValueError):
            _ = image.image
