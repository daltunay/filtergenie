#!/usr/bin/env python
import argparse
import json
import sys

from . import is_search_page, scrape_product_from_url, scrape_search_from_url

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Scrape product information from e-commerce websites."
    )
    parser.add_argument("url", help="URL of the product page or search page to scrape")
    args = parser.parse_args()

    try:
        if is_search_page(args.url):
            results = scrape_search_from_url(args.url)
            print(f"Found {len(results)} search results:")
            for i, product in enumerate(results, 1):
                print(i, json.dumps(product.model_dump(), indent=2))
        else:
            product = scrape_product_from_url(args.url)
            print(json.dumps(product.model_dump(), indent=2))
    except Exception as e:
        print(f"Error: {str(e)}")
        sys.exit(1)
