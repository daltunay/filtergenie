import argparse

import structlog

from . import get_page_type, scrape_product, scrape_search_results

logger = structlog.get_logger(__name__)


def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="E-commerce scraper tool")
    parser.add_argument("url", help="URL to scrape")
    parser.add_argument(
        "--max-items",
        "-m",
        type=int,
        default=5,
        help="Maximum number of items to scrape from search results",
    )
    return parser.parse_args()


def main() -> None:
    """Main entry point for the scraper CLI."""
    args = parse_args()

    page_type = get_page_type(args.url)

    if page_type == "product":
        logger.info("Scraping product page", url=args.url)
        result = scrape_product(args.url)
        logger.info("Scraped product", result=result)

    elif page_type == "search":
        logger.info(
            "Scraping search results page", url=args.url, max_items=args.max_items
        )
        results = scrape_search_results(args.url, max_items=args.max_items)
        logger.info("Scraped search results", results=results)

    else:
        logger.error("Unknown page type or unsupported domain", url=args.url)


if __name__ == "__main__":
    main()
