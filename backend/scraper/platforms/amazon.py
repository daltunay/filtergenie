from bs4 import BeautifulSoup

from backend.scraper.base import BaseScraper


class AmazonScraper(BaseScraper):
    @classmethod
    def extract_title(cls, soup: BeautifulSoup) -> str:
        title_elem = soup.find(
            "span", class_="a-size-large product-title-word-break", attrs={"id": "productTitle"}
        )
        return title_elem.text.strip() if title_elem else ""

    @classmethod
    def extract_images(cls, soup: BeautifulSoup) -> list[str]:
        photos_container = soup.find(
            "ul",
            class_="a-unordered-list a-nostyle a-button-list a-declarative a-button-toggle-group a-vertical a-spacing-top-micro regularAltImageViewLayout",
        )
        img_elements = photos_container.find_all("img") if photos_container else []
        return [img["src"] for img in img_elements if img.get("src")]

    @classmethod
    def extract_description(cls, soup: BeautifulSoup) -> dict[str, str]:
        desc_container = soup.find("ul", class_="a-unordered-list a-vertical a-spacing-mini")
        if not desc_container:
            return {"description": ""}
        desc_items = desc_container.find_all("span", class_="a-list-item")
        description = " ".join(item.text.strip() for item in desc_items) if desc_items else ""
        return {"description": description}
