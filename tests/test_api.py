from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from backend.app import app

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@patch("backend.api.routes.scrape_product")
def test_get_product(mock_scrape_product, mock_product):
    """Test the product endpoint."""
    mock_scrape_product.return_value = AsyncMock(return_value=mock_product)()

    response = client.get(
        "/product/https://www.leboncoin.fr/ad/instruments_de_musique/1234567890"
    )

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == mock_product.id
    assert data["title"] == mock_product.title
    assert data["vendor"] == mock_product.vendor


@patch("backend.api.routes.scrape_product")
@patch("backend.api.routes.analyzer.analyze_product")
def test_analyze_product(mock_analyze_product, mock_scrape_product, mock_product):
    """Test the analyze product endpoint."""
    mock_scrape_product.return_value = AsyncMock(return_value=mock_product)()
    mock_analyze_product.return_value = AsyncMock(return_value=mock_product)()

    response = client.post(
        "/product/analyze?product_url=https://www.leboncoin.fr/ad/instruments_de_musique/1234567890",
        json={"filters": ["No visible damage", "Original packaging included"]},
    )

    assert response.status_code == 200
    data = response.json()
    assert "matches_filters" in data
    assert "filters" in data
    assert len(data["filters"]) == 2


@patch("backend.api.routes.get_product_id_from_url")
@patch("backend.api.routes.analyze_product_safely")
def test_extension_filter(
    mock_analyze_safely, mock_get_product_id, mock_product_response
):
    """Test the extension filter endpoint."""
    mock_get_product_id.return_value = 1234567890
    mock_analyze_safely.return_value = AsyncMock(return_value=mock_product_response)()

    response = client.post(
        "/extension/filter",
        json={
            "filters": ["No visible damage"],
            "product_urls": [
                "https://www.leboncoin.fr/instruments_de_musique/1234567890.htm"
            ],
            "max_products": 5,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert "products" in data
    assert isinstance(data["products"], list)


@patch("backend.api.routes.get_scraper_class_for_url")
def test_check_url(mock_get_scraper_class, mock_scraper_class):
    """Test the check URL endpoint."""
    mock_get_scraper_class.return_value = mock_scraper_class
    mock_scraper_class.find_page_type.return_value = "search"
    mock_scraper_class.get_vendor_name.return_value = "leboncoin"

    response = client.get(
        "/extension/check-url?url=https://www.leboncoin.fr/recherche?text=guitare"
    )

    assert response.status_code == 200
    data = response.json()
    assert data["supported"] is True
    assert data["vendor"] == "leboncoin"
    assert data["page_type"] == "search"
    assert data["is_search_page"] is True


# Fixtures for testing
@pytest.fixture
def mock_product():
    """Create a mock Product for testing."""
    from backend.analyzer.models import Product, ProductFilter

    product = Product(
        url="https://www.leboncoin.fr/instruments_de_musique/1234567890.htm",
        title="Guitare acoustique en parfait état",
        description="Guitare acoustique de marque Martin, achetée il y a 2 ans, très peu utilisée.",
    )
    product.id = 1234567890
    product.vendor = "leboncoin"
    product.filters = [
        ProductFilter(description="No visible damage"),
        ProductFilter(description="Original packaging included"),
    ]
    product.filters[0].value = True
    product.filters[1].value = False
    return product


@pytest.fixture
def mock_product_response():
    """Create a mock product response for testing."""
    return {
        "id": 1234567890,
        "url": "https://www.leboncoin.fr/instruments_de_musique/1234567890.htm",
        "title": "Guitare acoustique en parfait état",
        "matches_filters": True,
        "filters": [{"description": "No visible damage", "value": True}],
    }


@pytest.fixture
def mock_scraper_class():
    """Create a mock scraper class for testing."""
    from unittest.mock import MagicMock

    return MagicMock()
