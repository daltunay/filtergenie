import datetime
import json
import os
import typing as tp
from contextlib import contextmanager
from pathlib import Path

import duckdb
import structlog

from backend.analyzer import Product, ProductFilter, ProductImage

logger = structlog.get_logger(__name__=__name__)

# Define database path
DB_PATH = Path(os.environ.get("DUCKDB_PATH", "products.db"))

# Global connection pool for reuse - contains active connections
_db_connections = {}


@contextmanager
def db_connection(
    connection_id: str = "default",
) -> tp.Generator[duckdb.DuckDBPyConnection, None, None]:
    """Context manager for database connections with optional connection reuse."""
    global _db_connections

    # Check if we have an existing connection to reuse
    conn = _db_connections.get(connection_id)
    close_after = False

    if conn is None:
        # Create a new connection
        conn = duckdb.connect(str(DB_PATH))
        close_after = True  # We'll close this connection when done

    try:
        yield conn
    except Exception as e:
        logger.error("Database operation error", error=str(e))
        raise
    finally:
        if close_after and conn:
            conn.close()


def get_persistent_connection(
    connection_id: str = "default",
) -> duckdb.DuckDBPyConnection:
    """Get or create a persistent database connection that will be reused."""
    global _db_connections

    if connection_id not in _db_connections:
        _db_connections[connection_id] = duckdb.connect(str(DB_PATH))

    return _db_connections[connection_id]


def close_persistent_connection(connection_id: str = "default") -> None:
    """Close a persistent connection if it exists."""
    global _db_connections

    if connection_id in _db_connections:
        _db_connections[connection_id].close()
        del _db_connections[connection_id]


def close_all_connections() -> None:
    """Close all persistent connections."""
    global _db_connections

    for conn_id in list(_db_connections.keys()):
        close_persistent_connection(conn_id)


def init_db(conn: duckdb.DuckDBPyConnection | None = None):
    """Initialize the database schema if tables don't exist."""
    if conn:
        # Use provided connection
        _init_db_schema(conn)
    else:
        # Use a new connection
        with db_connection() as conn:
            _init_db_schema(conn)


def _init_db_schema(conn: duckdb.DuckDBPyConnection):
    """Helper to create database schema using an existing connection."""
    # Create products table with JSON column for images
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS products (
            platform VARCHAR,
            id BIGINT,
            url VARCHAR UNIQUE,
            title VARCHAR,
            description TEXT,
            images VARCHAR, -- Stored as JSON string of image URLs
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (platform, id)
        )
    """
    )

    # Create filters table
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS filters (
            product_platform VARCHAR,
            product_id BIGINT,
            description VARCHAR,
            name VARCHAR,
            value BOOLEAN,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (product_platform, product_id, description),
            FOREIGN KEY (product_platform, product_id) REFERENCES products(platform, id)
        )
    """
    )

    logger.info("Database initialized", path=str(DB_PATH))


def store_product(
    product: Product, conn: duckdb.DuckDBPyConnection | None = None
) -> bool:
    """Store a product in the database."""
    if not product.platform or product.id is None:
        logger.warning("Cannot store product without platform and id")
        return False

    try:
        if conn:
            return _store_product_with_conn(product, conn)
        else:
            with db_connection() as new_conn:
                return _store_product_with_conn(product, new_conn)

    except Exception as e:
        logger.error(
            "Error storing product",
            error=str(e),
            platform=product.platform,
            product_id=product.id,
        )
        return False


def _store_product_with_conn(product: Product, conn: duckdb.DuckDBPyConnection) -> bool:
    """Helper to store a product using an existing connection."""
    if not product.cache_key:
        logger.warning("Cannot store product without valid cache key (platform and id)")
        return False

    platform, product_id = product.cache_key
    product_dict = product.model_dump(exclude_none=True)

    # Convert images list to JSON string
    images_json = json.dumps([str(img.url_or_path) for img in product.images])

    conn.execute("BEGIN TRANSACTION")

    try:
        # Check if product exists
        result = conn.execute(
            "SELECT 1 FROM products WHERE platform = ? AND id = ?",
            [platform, product_id],
        ).fetchone()

        if result:
            # Update existing product
            conn.execute(
                """
                UPDATE products 
                SET title = ?, description = ?, images = ?, last_accessed_at = ? 
                WHERE platform = ? AND id = ?
                """,
                [
                    product_dict["title"],
                    product_dict["description"],
                    images_json,
                    datetime.datetime.now(),
                    platform,
                    product_id,
                ],
            )
        else:
            # Insert new product
            conn.execute(
                """
                INSERT INTO products (platform, id, url, title, description, images)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                [
                    platform,
                    product_id,
                    product_dict["url"].__str__(),
                    product_dict["title"],
                    product_dict["description"],
                    images_json,
                ],
            )

        conn.execute("COMMIT")
        return True

    except Exception:
        conn.execute("ROLLBACK")
        raise


def store_product_filters(
    product: Product, conn: duckdb.DuckDBPyConnection | None = None
) -> bool:
    """Store product filters in the database."""
    if not product.cache_key or not product.filters:
        return False

    try:
        if conn:
            return _store_product_filters_with_conn(product, conn)
        else:
            with db_connection() as new_conn:
                return _store_product_filters_with_conn(product, new_conn)

    except Exception as e:
        logger.error(
            "Error storing filters",
            error=str(e),
            platform=product.platform,
            product_id=product.id,
        )
        return False


def _store_product_filters_with_conn(
    product: Product, conn: duckdb.DuckDBPyConnection
) -> bool:
    """Helper to store product filters using an existing connection."""
    conn.execute("BEGIN TRANSACTION")

    try:
        platform, product_id = product.cache_key

        # Delete old filters
        conn.execute(
            "DELETE FROM filters WHERE product_platform = ? AND product_id = ?",
            [platform, product_id],
        )

        # Insert new filters
        for filter_item in product.filters:
            conn.execute(
                """
                INSERT INTO filters (product_platform, product_id, description, name, value)
                VALUES (?, ?, ?, ?, ?)
                """,
                [
                    platform,
                    product_id,
                    filter_item.description,
                    filter_item.name,
                    filter_item.value,
                ],
            )

        conn.execute("COMMIT")
        return True

    except Exception:
        conn.execute("ROLLBACK")
        raise


def get_product(
    platform: str, product_id: int, conn: duckdb.DuckDBPyConnection | None = None
) -> Product | None:
    """Retrieve a product from the database."""
    try:
        if conn:
            return _get_product_with_conn(platform, product_id, conn)
        else:
            with db_connection() as new_conn:
                return _get_product_with_conn(platform, product_id, new_conn)

    except Exception as e:
        logger.error(
            "Error retrieving product",
            error=str(e),
            platform=platform,
            product_id=product_id,
        )
        return None


def _get_product_with_conn(
    platform: str, product_id: int, conn: duckdb.DuckDBPyConnection
) -> Product | None:
    """Helper to retrieve a product using an existing connection."""
    # Get product details including images JSON
    product_data = conn.execute(
        """
        SELECT url, title, description, images
        FROM products
        WHERE platform = ? AND id = ?
        """,
        [platform, product_id],
    ).fetchone()

    if not product_data:
        return None

    url, title, description, images_json = product_data

    # Update last accessed timestamp
    conn.execute(
        "UPDATE products SET last_accessed_at = ? WHERE platform = ? AND id = ?",
        [datetime.datetime.now(), platform, product_id],
    )

    # Parse images from JSON
    image_urls = json.loads(images_json) if images_json else []

    # Create the product directly
    product = Product(
        url=url,
        title=title,
        description=description,
    )

    # Set images, platform and id manually
    product.images = [ProductImage(url_or_path=img_url) for img_url in image_urls]
    product.id = product_id
    product.platform = platform

    return product


def get_product_filters(
    platform: str,
    product_id: int,
    filter_descriptions: list[str],
    conn: duckdb.DuckDBPyConnection | None = None,
) -> list[ProductFilter]:
    """Retrieve filters for a product from the database."""
    try:
        if conn:
            return _get_product_filters_with_conn(
                platform, product_id, filter_descriptions, conn
            )
        else:
            with db_connection() as new_conn:
                return _get_product_filters_with_conn(
                    platform, product_id, filter_descriptions, new_conn
                )

    except Exception as e:
        logger.error(
            "Error retrieving filters",
            error=str(e),
            platform=platform,
            product_id=product_id,
        )
        return []


def _get_product_filters_with_conn(
    platform: str,
    product_id: int,
    filter_descriptions: list[str],
    conn: duckdb.DuckDBPyConnection,
) -> list[ProductFilter]:
    """Helper to retrieve product filters using an existing connection."""
    filter_list = []

    if not filter_descriptions:
        return filter_list

    # Fetch all filters at once with a parameterized query
    placeholders = ",".join(["?"] * len(filter_descriptions))
    query_params = [platform, product_id] + filter_descriptions

    filter_data = conn.execute(
        f"""
        SELECT description, name, value 
        FROM filters
        WHERE product_platform = ? AND product_id = ? AND description IN ({placeholders})
        """,
        query_params,
    ).fetchall()

    # Create filter objects
    for description, name, value in filter_data:
        filter_item = ProductFilter(description=description)
        filter_item.name = name
        filter_item.value = value
        filter_list.append(filter_item)

    return filter_list


def clear_cache(conn: duckdb.DuckDBPyConnection | None = None):
    """Clear the entire cache database."""
    try:
        if conn:
            _clear_cache_with_conn(conn)
        else:
            with db_connection() as new_conn:
                _clear_cache_with_conn(new_conn)

    except Exception as e:
        logger.error("Error clearing cache", error=str(e))


def _clear_cache_with_conn(conn: duckdb.DuckDBPyConnection):
    """Helper to clear the cache using an existing connection."""
    conn.execute("BEGIN TRANSACTION")
    conn.execute("DELETE FROM filters")
    conn.execute("DELETE FROM products")
    conn.execute("COMMIT")
    logger.info("Database cache cleared")


# Initialize the database when the module is imported
init_db()
