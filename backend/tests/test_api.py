import os

from fastapi.testclient import TestClient

from backend.app import app

client = TestClient(app)


def test_index():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Welcome to the FilterGenie API!"}


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_auth_check_requires_api_key(monkeypatch):
    os.environ["API__KEY"] = "testkey"
    from backend.config import settings

    settings.api.key = "testkey"
    response = client.get("/auth/check")
    assert response.status_code == 401 or response.status_code == 403
    response = client.get("/auth/check", headers={"X-API-Key": "wrong"})
    assert response.status_code == 403
    response = client.get("/auth/check", headers={"X-API-Key": "testkey"})
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_cache_clear_requires_api_key(monkeypatch):
    os.environ["API__KEY"] = "testkey"
    from backend.config import settings

    settings.api.key = "testkey"
    response = client.post("/cache/clear")
    assert response.status_code == 401 or response.status_code == 403
    response = client.post("/cache/clear", headers={"X-API-Key": "wrong"})
    assert response.status_code == 403
    response = client.post("/cache/clear", headers={"X-API-Key": "testkey"})
    assert response.status_code not in (401, 403)


def test_items_analyze_requires_api_key(monkeypatch):
    os.environ["API__KEY"] = "testkey"
    from backend.config import settings

    settings.api.key = "testkey"
    payload = {
        "items": [{"platform": "vinted", "url": "http://foo", "html": "<html></html>"}],
        "filters": ["Red"],
    }
    response = client.post("/items/analyze", json=payload)
    assert response.status_code == 401 or response.status_code == 403
    response = client.post("/items/analyze", json=payload, headers={"X-API-Key": "wrong"})
    assert response.status_code == 403
    response = client.post("/items/analyze", json=payload, headers={"X-API-Key": "testkey"})
    assert response.status_code not in (401, 403)
