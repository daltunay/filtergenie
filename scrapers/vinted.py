import structlog
from bs4 import BeautifulSoup

from .base import BaseScraper

logger = structlog.get_logger(__name__)


class VintedScraper(BaseScraper):
    """Scraper for vinted.fr product pages."""

    SUPPORTED_DOMAINS = ["vinted.fr", "vinted.com"]

    @staticmethod
    def extract_title(soup: BeautifulSoup) -> str:
        title_elem = soup.find("span", class_="web_ui__Text__title")
        return title_elem.text.strip() if title_elem else ""

    @staticmethod
    def extract_description(soup: BeautifulSoup) -> str:
        desc_container = soup.find("div", attrs={"itemprop": "description"})
        desc_text = desc_container.find("span", class_="web_ui__Text__text")
        return desc_text.text.strip()

    @staticmethod
    def extract_images(soup: BeautifulSoup) -> list[str]:
        photos_container = soup.find("div", class_="item-photos")
        img_elements = photos_container.find_all("img")
        image_urls = []
        for img in img_elements:
            image_urls.append(img["src"])
        return image_urls


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Scrape a Vinted product page.")
    parser.add_argument("url", type=str, help="The URL of the Vinted product page")
    args = parser.parse_args()

    scraper = VintedScraper()
    product = scraper.scrape(args.url)
    print(product)
