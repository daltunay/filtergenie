from bs4 import BeautifulSoup

from backend.scraper.base import BaseScraper


class AmazonScraper(BaseScraper):
    @classmethod
    def extract_title(cls, soup: BeautifulSoup) -> str:
        title_span = soup.find("span", class_="a-size-large product-title-word-break")
        return title_span.text.strip() if title_span else ""

    @classmethod
    def extract_images(cls, soup: BeautifulSoup) -> list[str]:
        image_urls = []
        image_container = soup.find("div", class_="a-fixed-left-grid-inner")
        img_elements = image_container.find_all("img") if image_container else []
        for img in img_elements:
            image_url = img.get("src")
            if image_url:
                image_urls.append(image_url)
        return image_urls
