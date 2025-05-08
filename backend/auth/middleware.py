from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader
from loguru import logger

from backend.config import settings

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def verify_api_key(api_key: str = Security(api_key_header)) -> bool:
    """Validate API key if one is set in environment."""
    if not settings.api.key:
        logger.debug("API key validation skipped (no key configured)")
        return True

    if not api_key:
        logger.warning("API request rejected - missing API key")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="API key missing")

    if api_key != settings.api.key:
        logger.warning("API request rejected - invalid API key provided")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid API key")

    logger.debug("API key validated successfully")
    return True
