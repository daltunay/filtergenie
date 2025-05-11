from bs4 import BeautifulSoup

from backend.scraper.base import BaseScraper


class VintedScraper(BaseScraper):
    @classmethod
    def extract_title(cls, soup: BeautifulSoup) -> str:
        title_elem = soup.find("span", class_="web_ui__Text__title")
        return title_elem.text.strip() if title_elem else ""

    @classmethod
    def extract_images(cls, soup: BeautifulSoup) -> list[str]:
        photos_container = soup.find("div", class_="item-photos")
        img_elements = photos_container.find_all("img") if photos_container else []
        return [img["src"] for img in img_elements if img.get("src")]

    @classmethod
    def extract_description(cls, soup: BeautifulSoup) -> dict[str, str]:
        desc_container = soup.find("div", attrs={"itemprop": "description"})
        if not desc_container:
            return {"description": ""}
        desc_text = desc_container.find("span", class_="web_ui__Text__text")
        description = desc_text.text.strip() if desc_text else ""
        return {"description": description}
