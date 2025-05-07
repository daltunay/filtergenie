from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader

from backend.config import settings

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def verify_api_key(api_key: str = Security(api_key_header)) -> bool:
    """Validate API key if one is set in environment."""
    if not settings.api.key:
        return True

    if not api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="API key missing")

    if api_key != settings.api.key:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid API key")

    return True
