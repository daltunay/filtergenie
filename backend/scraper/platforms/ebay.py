from bs4 import BeautifulSoup

from backend.scraper.base import BaseScraper


class EbayScraper(BaseScraper):
    @classmethod
    def extract_title(cls, soup: BeautifulSoup) -> str:
        title_elem = soup.find("h1", class_="x-item-title__mainTitle")
        title_span = title_elem.find("span", class_="ux-textspans") if title_elem else None
        return title_span.text.strip() if title_span else ""

    @classmethod
    def extract_images(cls, soup: BeautifulSoup) -> list[str]:
        image_urls = []
        image_container = soup.find("div", class_="ux-image-grid no-scrollbar")
        img_elements = image_container.find_all("img") if image_container else []
        for img in img_elements:
            image_url = img.get("src") or img.get("data-src")
            if image_url:
                image_urls.append(image_url)
        return image_urls
