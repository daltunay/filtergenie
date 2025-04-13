import structlog
from bs4 import BeautifulSoup

from .base import BaseScraper

logger = structlog.get_logger(__name__)


class LeboncoinScraper(BaseScraper):
    """Scraper for leboncoin.fr product pages."""

    SUPPORTED_DOMAINS = ["leboncoin.fr"]

    def extract_title(self, soup: BeautifulSoup) -> str:
        title_elem = soup.find(
            "h1",
            class_="text-headline-1-expanded",
            attrs={"data-qa-id": "adview_title"},
        )
        return title_elem.text.strip()

    def extract_description(self, soup: BeautifulSoup) -> str:
        desc_container = soup.find(
            "div", attrs={"data-qa-id": "adview_description_container"}
        )
        desc_elem = desc_container.find("p")
        return desc_elem.text.strip()

    def extract_images(self, soup: BeautifulSoup) -> list[str]:
        image_urls = []
        gallery_section = soup.find(
            "section", attrs={"aria-label": "Aller à la galerie de photos"}
        )
        picture_elements = gallery_section.find_all("picture")
        for picture in picture_elements:
            jpeg_source = picture.find("source", attrs={"type": "image/jpeg"})
            image_urls.append(jpeg_source["srcset"].strip())

        return image_urls


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Scrape a Leboncoin product page.")
    parser.add_argument("url", type=str, help="The URL of the Leboncoin product page")
    args = parser.parse_args()

    scraper = LeboncoinScraper()
    product = scraper.scrape(args.url)
    print(product)
