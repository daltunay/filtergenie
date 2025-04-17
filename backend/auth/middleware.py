from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader

from backend.config import settings

# Define API key header
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

# Public routes that don't require authentication
public_paths = ["/health"]


def verify_api_key(api_key: str = Security(api_key_header)) -> bool:
    """
    Validate API key if one is set in environment.

    If API_KEY env var is not set, authentication is disabled.
    """
    # If API_KEY is not set in environment, skip authentication
    required_key = settings.api_key
    if not required_key:
        return True

    # Validate the provided API key
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="API key missing"
        )

    if api_key != required_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Invalid API key"
        )

    return True
