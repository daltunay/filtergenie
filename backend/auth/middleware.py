from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader

from backend.config import settings

api_key_header = APIKeyHeader(title="X-API-Key", auto_error=False)


def verify_api_key(api_key: str = Security(api_key_header)) -> bool:
    """
    Validate API key if one is set in environment.

    If API_KEY env var is not set, authentication is disabled.
    """
    if not settings.api_key:
        return True

    if not api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="API key missing")

    if api_key != settings.api_key:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid API key")

    return True
