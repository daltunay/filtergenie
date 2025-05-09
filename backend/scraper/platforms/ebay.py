from bs4 import BeautifulSoup

from backend.common.safe import safe_call
from backend.scraper.base import BaseScraper


class EbayScraper(BaseScraper):
    """Scraper for eBay."""

    PLATFORM = "eBay"
    SUPPORTED_DOMAINS = ["ebay.com", "ebay.fr"]
    PAGE_TYPE_PATTERNS = {
        "item": ["/itm/"],
        "search": ["/sch/", "/b/"],
    }

    @staticmethod
    @safe_call
    def extract_item_title(soup: BeautifulSoup) -> str:
        title_elem = soup.find("h1", class_="x-item-title__mainTitle")
        title_span = title_elem.find("span", class_="ux-textspans")
        return title_span.text.strip()

    @staticmethod
    @safe_call
    def extract_item_images(soup: BeautifulSoup) -> list[str]:
        image_urls = []
        image_container = soup.find("div", class_="ux-image-grid no-scrollbar")
        img_elements = image_container.find_all("img")
        for img in img_elements:
            if image_url := (img.get("src") or img.get("data-src")):
                image_urls.append(image_url)
        return image_urls
