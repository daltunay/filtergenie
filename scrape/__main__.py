import argparse

import structlog

from . import get_page_type, scrape_product, scrape_search_page

log = structlog.get_logger()


def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="E-commerce scraper tool")
    parser.add_argument("url", help="URL to scrape")
    parser.add_argument(
        "--max-products",
        "-m",
        type=int,
        default=5,
        help="Maximum number of products to scrape from search results",
    )
    return parser.parse_args()


def main() -> None:
    """Main entry point for the scraper CLI."""
    args = parse_args()

    page_type = get_page_type(args.url)

    if page_type == "product":
        log.bind(url=args.url, page_type=page_type)
        log.info("Scraping product page")
        result = scrape_product(args.url)
        log.info("Scraped product", **result.model_dump())

    elif page_type == "search":
        log.bind(url=args.url, page_type=page_type, max_products=args.max_products)
        log.info("Scraping search results page")
        results = scrape_search_page(args.url, max_products=args.max_products)
        for i, result in enumerate(results, start=1):
            log.info("Scraped product", product_number=i, **result.model_dump())

    else:
        log.error("Unknown page type or unsupported domain")


if __name__ == "__main__":
    main()
