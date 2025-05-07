from bs4 import BeautifulSoup

from backend.scrape.base import BaseScraper


class VintedScraper(BaseScraper):
    """Scraper for Vinted."""

    PLATFORM = "Vinted"
    SUPPORTED_DOMAINS = ["vinted.fr", "vinted.com"]
    PAGE_TYPE_PATTERNS = {
        "item": ["/items/"],
        "search": ["/catalog"],
    }

    @staticmethod
    def extract_item_title(soup: BeautifulSoup) -> str:
        title_elem = soup.find("span", class_="web_ui__Text__title")
        return title_elem.text.strip() if title_elem else ""

    @staticmethod
    def extract_item_description(soup: BeautifulSoup) -> str:
        desc_container = soup.find("div", attrs={"itemprop": "description"})
        desc_text = desc_container.find("span", class_="web_ui__Text__text")
        return desc_text.text.strip()

    @staticmethod
    def extract_item_images(soup: BeautifulSoup) -> list[str]:
        photos_container = soup.find("div", class_="item-photos")
        img_elements = photos_container.find_all("img")
        image_urls = []
        for img in img_elements:
            image_urls.append(img["src"])
        return image_urls
