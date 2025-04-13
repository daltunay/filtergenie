#!/usr/bin/env python
import argparse

from . import scrape_product_from_url

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Scrape product information from e-commerce websites."
    )
    parser.add_argument("url", help="URL of the product page to scrape")
    args = parser.parse_args()

    product = scrape_product_from_url(args.url)
    print(product)
