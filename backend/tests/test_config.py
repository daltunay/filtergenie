from backend.config import LocalModelConfig, ModelConfig, RemoteModelConfig, Settings


def test_model_config_local_sets_local():
    config = ModelConfig(use_local=True, local=None, remote=None)
    assert config.use_local is True
    assert isinstance(config.local, LocalModelConfig)
    assert config.remote is None or isinstance(config.remote, RemoteModelConfig)


def test_model_config_remote_sets_remote():
    remote = RemoteModelConfig(api_key="dummy-remote-key")
    config = ModelConfig(use_local=False, local=None, remote=remote)
    assert config.use_local is False
    assert isinstance(config.remote, RemoteModelConfig)
    assert config.remote.api_key == "dummy-remote-key"
    assert config.local is None or isinstance(config.local, LocalModelConfig)


def test_settings_from_env(monkeypatch):
    monkeypatch.setenv("MODEL__USE_LOCAL", "true")
    monkeypatch.setenv("MODEL__LOCAL__NAME", "TestLocalModel")
    monkeypatch.setenv("MODEL__LOCAL__DTYPE", "float32")
    monkeypatch.setenv("MODEL__LOCAL__DEVICE", "cpu")
    monkeypatch.setenv("MODEL__REMOTE__API_KEY", "remote-key-123")
    monkeypatch.setenv("MODEL__REMOTE__BASE_URL", "https://remote.example.com/api/")
    monkeypatch.setenv("MODEL__REMOTE__NAME", "TestRemoteModel")
    monkeypatch.setenv("API__KEY", "test-api-key")
    settings = Settings()
    assert settings.model.use_local is True
    assert settings.model.local is not None
    assert settings.model.local.name == "TestLocalModel"
    assert settings.model.local.dtype == "float32"
    assert settings.model.local.device == "cpu"
    assert settings.model.remote is not None
    assert settings.model.remote.api_key == "remote-key-123"
    assert settings.model.remote.base_url == "https://remote.example.com/api/"
    assert settings.model.remote.name == "TestRemoteModel"
    assert settings.api.key == "test-api-key"


def test_secure_api_key(monkeypatch):
    monkeypatch.setenv("MODEL__USE_LOCAL", "false")
    monkeypatch.setenv("API__KEY", "dummy-api-key")
    settings = Settings()
    assert settings.model.use_local is False
    assert settings.model.remote is not None
    assert settings.api.key == "dummy-api-key"
    assert settings.api.is_secure is True

    monkeypatch.delenv("API__KEY", raising=False)
    settings = Settings()
    assert settings.model.use_local is False
    assert settings.model.remote is not None
    assert settings.api.key is None
    assert settings.api.is_secure is False
