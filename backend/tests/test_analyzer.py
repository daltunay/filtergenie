import pytest
from pydantic import BaseModel

from backend.analyzer.engine import Analyzer
from backend.analyzer.models import FilterModel, ImageModel, ItemModel
from backend.config import RemoteModelConfig


class DummyModel:
    async def predict(
        self, prompt: str, images: list[ImageModel], schema: type[BaseModel]
    ) -> object:
        class Response:
            pass

        resp = Response()
        for name in schema.model_fields:
            setattr(resp, name, True)
        return resp


class DummyRemoteModel:
    async def predict(
        self, prompt: str, images: list[ImageModel], schema: type[BaseModel]
    ) -> object:
        class Response:
            pass

        resp = Response()
        for name in schema.model_fields:
            setattr(resp, name, False)
        return resp


@pytest.fixture
def local_analyzer():
    analyzer = Analyzer(use_local=True)
    analyzer.predict = DummyModel().predict
    return analyzer


@pytest.fixture
def remote_analyzer():
    remote_config = RemoteModelConfig(api_key="dummy-key")
    analyzer = Analyzer(use_local=False, remote_config=remote_config)
    analyzer.predict = DummyRemoteModel().predict
    return analyzer


@pytest.mark.parametrize(
    "analyzer_fixture,expected",
    [
        ("local_analyzer", True),
        ("remote_analyzer", False),
    ],
)
def test_analyze_item_all_filters(analyzer_fixture, expected, request):
    analyzer = request.getfixturevalue(analyzer_fixture)
    item = ItemModel(platform="test", title="Test Item", images=[], url="http://example.com/item")
    filters = [
        FilterModel(desc="Red color"),
        FilterModel(desc="Large size"),
    ]
    import asyncio

    result = asyncio.run(analyzer.analyze_item(item, filters))
    assert all(f.value is expected for f in result)


@pytest.mark.parametrize(
    "analyzer_fixture,expected",
    [
        ("local_analyzer", True),
        ("remote_analyzer", False),
    ],
)
def test_analyze_item_with_images(analyzer_fixture, expected, request):
    analyzer = request.getfixturevalue(analyzer_fixture)
    image = ImageModel(url="http://example.com/image.jpg")
    item = ItemModel(
        platform="test",
        title="Test Item with Image",
        images=[image],
        url="http://example.com/item2",
    )
    filters = [FilterModel(desc="Has image")]
    import asyncio

    result = asyncio.run(analyzer.analyze_item(item, filters))
    assert result[0].value is expected
