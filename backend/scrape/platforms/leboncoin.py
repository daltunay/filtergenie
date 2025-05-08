from bs4 import BeautifulSoup

from backend.common.safe import safe_call
from backend.scrape.base import BaseScraper


class LeboncoinScraper(BaseScraper):
    """Scraper for leboncoin."""

    PLATFORM = "leboncoin"
    SUPPORTED_DOMAINS = ["leboncoin.fr"]
    PAGE_TYPE_PATTERNS = {
        "item": ["/ad/"],
        "search": ["/recherche", "/c/"],
    }

    @staticmethod
    @safe_call
    def extract_item_title(soup: BeautifulSoup) -> str:
        title_elem = soup.find(
            "h1",
            class_="text-headline-1-expanded",
            attrs={"data-qa-id": "adview_title"},
        )
        return title_elem.text.strip()

    @staticmethod
    @safe_call
    def extract_item_images(soup: BeautifulSoup) -> list[str]:
        image_urls: list[str] = []
        seen_urls = set()
        gallery_section = soup.find("div", class_="slick-list")

        if not gallery_section:
            return image_urls

        for gallery_section_refine in gallery_section.find_all(
            "div",
            class_=["slick-slide", "slick-slide slick-active slick-current"],
        ):
            picture_elements = gallery_section_refine.find_all("picture")

            for picture in picture_elements:
                img_element = picture.find("img")
                if img_element and "src" in img_element.attrs:
                    image_url = img_element["src"].strip()
                    if image_url not in seen_urls:
                        seen_urls.add(image_url)
                        image_urls.append(image_url)

        return image_urls

    @staticmethod
    @safe_call
    def extract_item_description(soup: BeautifulSoup) -> str:
        desc_container = soup.find("div", attrs={"data-qa-id": "adview_description_container"})
        desc_elem = desc_container.find("p")
        return desc_elem.text.strip()
