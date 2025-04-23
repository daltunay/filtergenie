import typing as tp
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from backend.app import app

# Create test client
client = TestClient(app)


def test_health_check() -> None:
    """Test the health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


# Test with authentication disabled
@pytest.fixture
def disable_auth() -> tp.Generator[None, None, None]:
    """Fixture to disable authentication for testing."""
    with patch("backend.auth.middleware.verify_api_key", return_value=True):
        yield


def test_analyze_products_unauthorized() -> None:
    """Test that unauthenticated requests are rejected."""
    payload = {
        "filters": ["Test filter"],
        "products": [
            {
                "url": "https://www.example.com/product/123",
                "html": "<html><body>Test product</body></html>",
            }
        ],
    }

    # Mock API key requirement
    with patch("backend.config.settings.api_key", "test_key"):
        response = client.post("/products/analyze", json=payload)
        assert response.status_code == 401  # Unauthorized


def test_analyze_products_empty(disable_auth: None) -> None:
    """Test analyzing with empty product list."""
    payload = {"filters": ["Test filter"], "products": []}
    response = client.post("/products/analyze", json=payload)
    assert response.status_code == 200
    assert response.json() == {"products": []}


def test_analyze_products(disable_auth: None) -> None:
    """Test the product analysis endpoint with mocked services."""
    # Mock the product service to return predefined results
    mock_result = {
        "url": "https://www.example.com/product/123",
        "id": 123,
        "title": "Test Product",
        "matches_all_filters": True,
        "filters": [{"description": "Test filter", "value": True}],
        "match_count": 1,
        "total_filters": 1,
    }

    # Use a more specific mock path to ensure the route uses our mock
    with patch("backend.api.routes.process_and_analyze", return_value=mock_result):
        payload = {
            "filters": ["Test filter"],
            "products": [
                {
                    "url": "https://www.example.com/product/123",
                    "html": "<html><body>Test product</body></html>",
                }
            ],
        }
        response = client.post("/products/analyze", json=payload)
        assert response.status_code == 200
        result = response.json()
        assert "products" in result
        assert len(result["products"]) == 1
        assert result["products"][0]["matches_all_filters"] is True
        assert result["products"][0]["url"] == "https://www.example.com/product/123"


def test_analyze_products_with_multiple_items(disable_auth: None) -> None:
    """Test analyzing multiple products with different results."""
    # Create mock results for multiple products
    mock_results = [
        {
            "url": "https://www.example.com/product/123",
            "id": 123,
            "title": "Product 1",
            "matches_all_filters": True,
            "filters": [{"description": "Test filter", "value": True}],
            "match_count": 1,
            "total_filters": 1,
        },
        {
            "url": "https://www.example.com/product/456",
            "id": 456,
            "title": "Product 2",
            "matches_all_filters": False,
            "filters": [{"description": "Test filter", "value": False}],
            "match_count": 0,
            "total_filters": 1,
        },
    ]

    # Use side_effect to return different results for each call
    with patch("backend.api.routes.process_and_analyze", side_effect=mock_results):
        payload = {
            "filters": ["Test filter"],
            "products": [
                {
                    "url": "https://www.example.com/product/123",
                    "html": "<html><body>Product 1</body></html>",
                },
                {
                    "url": "https://www.example.com/product/456",
                    "html": "<html><body>Product 2</body></html>",
                },
            ],
        }
        response = client.post("/products/analyze", json=payload)
        assert response.status_code == 200
        result = response.json()
        assert len(result["products"]) == 2
        assert result["products"][0]["matches_all_filters"] is True
        assert result["products"][1]["matches_all_filters"] is False


def test_analyze_products_validation_error(disable_auth: None) -> None:
    """Test validation error for malformed request."""
    # Missing required fields
    payload = {
        "filters": ["Test filter"]
        # Missing products field
    }
    response = client.post("/products/analyze", json=payload)
    assert response.status_code == 422  # Validation error

    # Invalid URL format
    payload = {
        "filters": ["Test filter"],
        "products": [
            {
                "url": "not-a-url",  # Invalid URL
                "html": "<html><body>Test product</body></html>",
            }
        ],
    }
    response = client.post("/products/analyze", json=payload)
    assert response.status_code == 422


def test_analyze_products_service_error(disable_auth: None) -> None:
    """Test error handling when service fails."""
    with patch(
        "backend.api.routes.process_and_analyze", side_effect=Exception("Service error")
    ):
        payload = {
            "filters": ["Test filter"],
            "products": [
                {
                    "url": "https://www.example.com/product/123",
                    "html": "<html><body>Test product</body></html>",
                }
            ],
        }
        response = client.post("/products/analyze", json=payload)
        assert response.status_code == 500
        assert "error" in response.json()["detail"].lower()
