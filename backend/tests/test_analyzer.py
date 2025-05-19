import pytest
from pydantic import BaseModel

from backend.analyzer.engine import Analyzer
from backend.analyzer.models import FilterModel, ImageModel, ItemModel


class DummyModel:
    async def predict(
        self, model: str, prompt: str, images: list[ImageModel], schema: type[BaseModel]
    ) -> object:
        class Response:
            pass

        resp = Response()
        for name in schema.model_fields:
            setattr(resp, name, True)
        return resp


class DummyRemoteModel:
    async def predict(
        self, model: str, prompt: str, images: list[ImageModel], schema: type[BaseModel]
    ) -> object:
        class Response:
            pass

        resp = Response()
        for name in schema.model_fields:
            setattr(resp, name, False)
        return resp


@pytest.mark.parametrize(
    "predict_class,expected",
    [
        (DummyModel, True),
        (DummyRemoteModel, False),
    ],
)
def test_analyze_item_all_filters(predict_class, expected):
    analyzer = Analyzer()
    analyzer.predict = predict_class().predict  # type: ignore[attr-defined]
    item = ItemModel(platform="test", title="Test Item", images=[], url="http://example.com/item")
    filters = [
        FilterModel(desc="Red color"),
        FilterModel(desc="Large size"),
    ]
    import asyncio

    result = asyncio.run(analyzer.analyze_item(item, filters))
    assert all(f.value is expected for f in result)


@pytest.mark.parametrize(
    "predict_class,expected",
    [
        (DummyModel, True),
        (DummyRemoteModel, False),
    ],
)
def test_analyze_item_with_images(predict_class, expected):
    analyzer = Analyzer()
    analyzer.predict = predict_class().predict  # type: ignore[attr-defined]
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
