from pydantic import BaseModel


class ProductRequest(BaseModel):
    url: str


class ProductResponse(BaseModel):
    id: int | None
    url: str
    title: str
    vendor: str | None


class AnalysisRequest(BaseModel):
    filters: list[str]


class AnalysisResponse(BaseModel):
    id: int | None
    url: str
    title: str
    matches_filters: bool
    filters: list[dict]


class BatchFilterRequest(BaseModel):
    filters: list[str]
    product_urls: list[str]
    max_products: int = 10


class ExtensionResponse(BaseModel):
    products: list[dict]
