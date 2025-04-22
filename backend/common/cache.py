import asyncio
import functools
import typing as tp

import duckdb
import structlog

from backend.analyzer.models import Product
from backend.common.db import clear_cache as db_clear_cache
from backend.common.db import (
    get_persistent_connection,
    get_product,
    get_product_filters,
    store_product,
    store_product_filters,
)

logger = structlog.get_logger(name="cache")

T = tp.TypeVar("T")  # Generic return type for decorated functions
F = tp.TypeVar("F", bound=tp.Callable[..., tp.Any])  # Type for the decorated function


class CacheConfig:
    """Configuration for the cache system."""

    # Class-level configuration
    db_conn: duckdb.DuckDBPyConnection | None = None
    enable_cache: bool = True

    @classmethod
    def configure(
        cls,
        db_conn: duckdb.DuckDBPyConnection | None = None,
        enable_cache: bool = True,
    ):
        """Configure the cache system globally."""
        cls.db_conn = db_conn
        cls.enable_cache = enable_cache


def get_database_connection() -> duckdb.DuckDBPyConnection:
    """Get the configured database connection or create a new persistent one."""
    if CacheConfig.db_conn:
        return CacheConfig.db_conn
    return get_persistent_connection("cache_decorator")


class CacheKeyExtractor:
    """Extract cache keys from different types of parameters"""

    @classmethod
    def extract_from_args(cls, args, kwargs) -> tuple[str | None, list[str] | None]:
        """Smart extraction of URL and filters from various argument types"""
        # First priority: Extract from request objects
        request = cls._find_request_object(args, kwargs)
        if request:
            url = getattr(request, "url", None) or getattr(request, "product_url", None)
            # For batch requests, we don't extract URL (return None)
            if hasattr(request, "product_urls") and not url:
                return None, getattr(request, "filters", None)
            return url, getattr(request, "filters", None)

        # Second priority: Direct URL parameter
        url = cls._find_url_param(args, kwargs)
        filters = cls._find_filters_param(args, kwargs)

        return url, filters

    @staticmethod
    def _find_request_object(args, kwargs) -> tp.Any:
        """Find a request object in args or kwargs"""
        # Check kwargs first
        for arg in kwargs.values():
            if hasattr(arg, "__dict__") and not isinstance(
                arg, (str, int, float, bool)
            ):
                return arg

        # Check args
        for arg in args:
            if hasattr(arg, "__dict__") and not isinstance(
                arg, (str, int, float, bool)
            ):
                return arg

        return None

    @staticmethod
    def _find_url_param(args, kwargs) -> str | None:
        """Find URL in positional args or kwargs"""
        # Check kwargs
        url = kwargs.get("url") or kwargs.get("product_url")
        if url and isinstance(url, str) and url.startswith(("http://", "https://")):
            return url

        # Check first positional arg
        if (
            args
            and isinstance(args[0], str)
            and args[0].startswith(("http://", "https://"))
        ):
            return args[0]

        return None

    @staticmethod
    def _find_filters_param(args, kwargs) -> list[str] | None:
        """Find filters in args or kwargs"""
        # Check kwargs
        filters = kwargs.get("filters")
        if (
            filters
            and isinstance(filters, list)
            and all(isinstance(f, str) for f in filters)
        ):
            return filters

        # Check args for a list of strings
        for arg in args:
            if isinstance(arg, list) and arg and all(isinstance(x, str) for x in arg):
                return arg

        return None


def cached(func=None, *, connection: duckdb.DuckDBPyConnection | None = None):
    """
    Smart caching decorator that handles different inputs automatically.
    """

    def decorator(func: F) -> F:
        is_async = asyncio.iscoroutinefunction(func)

        if is_async:

            @functools.wraps(func)
            async def async_wrapper(*args, **kwargs):
                if not CacheConfig.enable_cache:
                    return await func(*args, **kwargs)

                conn = connection or get_database_connection()

                # Smart extraction of cache parameters
                url, filters = CacheKeyExtractor.extract_from_args(args, kwargs)

                # If we have a URL, try to get from cache
                if url:
                    from backend.scrape import (
                        get_product_id_from_url,
                        get_vendor_for_url,
                    )

                    vendor = get_vendor_for_url(url)
                    product_id = get_product_id_from_url(url)

                    if vendor and product_id:
                        cached_product = get_product(vendor, product_id, conn=conn)

                        if cached_product:
                            if filters:
                                cached_filters = get_product_filters(
                                    vendor, product_id, filters, conn=conn
                                )
                                if cached_filters and len(cached_filters) == len(
                                    filters
                                ):
                                    cached_product.filters = cached_filters
                                    logger.debug(
                                        "Cache hit for product with filters", url=url
                                    )
                                    return cached_product
                            else:
                                logger.debug("Cache hit for product", url=url)
                                return cached_product

                # Cache miss - call the original function
                result = await func(*args, **kwargs)

                # Store the result if it's a Product
                if isinstance(result, Product) and result.cache_key:
                    store_product(result, conn=conn)
                    if result.filters:
                        store_product_filters(result, conn=conn)
                    logger.debug(
                        "Stored product in cache",
                        vendor=result.vendor,
                        product_id=result.id,
                    )

                return result

            return tp.cast(F, async_wrapper)
        else:

            @functools.wraps(func)
            def sync_wrapper(*args, **kwargs):
                if not CacheConfig.enable_cache:
                    return func(*args, **kwargs)

                conn = connection or get_database_connection()

                # Smart extraction of cache parameters
                url, filters = CacheKeyExtractor.extract_from_args(args, kwargs)

                # If we have a URL, try to get from cache
                if url:
                    from backend.scrape import (
                        get_product_id_from_url,
                        get_vendor_for_url,
                    )

                    vendor = get_vendor_for_url(url)
                    product_id = get_product_id_from_url(url)

                    if vendor and product_id:
                        cached_product = get_product(vendor, product_id, conn=conn)

                        if cached_product:
                            if filters:
                                cached_filters = get_product_filters(
                                    vendor, product_id, filters, conn=conn
                                )
                                if cached_filters and len(cached_filters) == len(
                                    filters
                                ):
                                    cached_product.filters = cached_filters
                                    logger.debug(
                                        "Cache hit for product with filters", url=url
                                    )
                                    return cached_product
                            else:
                                logger.debug("Cache hit for product", url=url)
                                return cached_product

                # Cache miss - call the original function
                result = func(*args, **kwargs)

                # Store the result if it's a Product
                if isinstance(result, Product) and result.cache_key:
                    store_product(result, conn=conn)
                    if result.filters:
                        store_product_filters(result, conn=conn)
                    logger.debug(
                        "Stored product in cache",
                        vendor=result.vendor,
                        product_id=result.id,
                    )

                return result

            return tp.cast(F, sync_wrapper)

    # Handle both @cached and @cached()
    if func is None:
        return decorator
    return decorator(func)


def clear_cache():
    """Clear the database cache."""
    db_clear_cache()
    logger.info("Cache cleared")


def configure_cache(db_conn=None, enable_cache=True):
    """Configure the cache system."""
    CacheConfig.configure(
        db_conn=db_conn,
        enable_cache=enable_cache,
    )
    logger.info(
        "Cache configured",
        has_connection=bool(db_conn),
        cache_enabled=enable_cache,
    )
