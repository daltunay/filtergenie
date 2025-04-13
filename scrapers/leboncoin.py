from urllib.parse import urlparse

import structlog
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

from .base import BaseScraper

logger = structlog.get_logger(__name__)


class LeboncoinScraper(BaseScraper):
    """Scraper for leboncoin.fr product pages."""

    @staticmethod
    def can_handle_url(url: str) -> bool:
        parsed_url = urlparse(url)
        return parsed_url.netloc.endswith("leboncoin.fr")

    def fetch_page(self, url: str) -> BeautifulSoup:
        logger.info("Fetching page with Playwright", url=url)

        with sync_playwright() as p:
            browser = p.firefox.launch(headless=self.HEADLESS_MODE)
            page = browser.new_page(viewport={"width": 1280, "height": 800})
            page.goto(url, timeout=self.PLAYWRIGHT_TIMEOUT)
            html_content = page.content()
            soup = BeautifulSoup(html_content, "html.parser")
        return soup

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
