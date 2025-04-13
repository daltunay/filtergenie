import structlog
from bs4 import BeautifulSoup

from .base import BaseScraper

logger = structlog.get_logger(__name__)


class EbayScraper(BaseScraper):
    """Scraper for ebay.com product pages."""

    SUPPORTED_DOMAINS = ["ebay.com", "ebay.fr"]

    @staticmethod
    def extract_title(soup: BeautifulSoup) -> str:
        title_elem = soup.find("h1", class_="x-item-title__mainTitle")
        title_span = title_elem.find("span", class_="ux-textspans")
        return title_span.text.strip()

    @staticmethod
    def extract_description(soup: BeautifulSoup) -> str:
        raise NotImplementedError("TODO: Implement description extraction for eBay")

    @staticmethod
    def extract_images(soup: BeautifulSoup) -> list[str]:
        image_urls = []
        image_container = soup.find("div", class_="ux-image-grid no-scrollbar")
        img_elements = image_container.find_all("img")
        for img in img_elements:
            if image_url := (img.get("src") or img.get("data-src")):
                image_urls.append(image_url)
        return image_urls


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Scrape an eBay product page.")
    parser.add_argument("url", type=str, help="The URL of the eBay product page")
    args = parser.parse_args()

    scraper = EbayScraper()
    product = scraper.scrape(args.url)
    print(product)
