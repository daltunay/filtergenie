from backend.config import Settings


def test_groq_config_from_env(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "dummy-groq-key")
    monkeypatch.setenv("GROQ_MODEL_NAME", "test-model")
    settings = Settings()
    assert settings.groq.api_key == "dummy-groq-key"
    assert settings.groq.model_name == "test-model"


def test_settings_from_env(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "remote-key-123")
    monkeypatch.setenv("GROQ_MODEL_NAME", "TestRemoteModel")
    monkeypatch.setenv("API_KEY", "test-api-key")
    settings = Settings()
    assert settings.groq.api_key == "remote-key-123"
    assert settings.groq.model_name == "TestRemoteModel"
    assert settings.api.key == "test-api-key"


def test_secure_api_key(monkeypatch):
    monkeypatch.setenv("API_KEY", "dummy-api-key")
    settings = Settings()
    assert settings.api.key == "dummy-api-key"
    assert settings.api.is_secure is True

    monkeypatch.delenv("API_KEY", raising=False)
    settings = Settings()
    assert settings.api.key is None
    assert settings.api.is_secure is False
