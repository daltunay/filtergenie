from bs4 import BeautifulSoup

from backend.scrape.base import BaseScraper


class LeboncoinScraper(BaseScraper):
    """Scraper for leboncoin."""

    SUPPORTED_DOMAINS = ["leboncoin.fr"]

    PAGE_TYPE_PATTERNS = {
        "product": ["/ad/"],
        "search": ["/recherche", "/c/"],
    }

    @staticmethod
    def extract_product_id(url: str) -> int:
        return int(url.split("/")[-1])

    @staticmethod
    def extract_product_title(soup: BeautifulSoup) -> str:
        title_elem = soup.find(
            "h1",
            class_="text-headline-1-expanded",
            attrs={"data-qa-id": "adview_title"},
        )
        return title_elem.text.strip()

    @staticmethod
    def extract_product_description(soup: BeautifulSoup) -> str:
        desc_container = soup.find(
            "div", attrs={"data-qa-id": "adview_description_container"}
        )
        desc_elem = desc_container.find("p")
        return desc_elem.text.strip()

    @staticmethod
    def extract_product_images(soup: BeautifulSoup) -> list[str]:
        image_urls = []
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
    def extract_product_urls(soup: BeautifulSoup) -> list[str]:
        ad_articles = soup.find_all(
            "article", attrs={"data-test-id": "ad", "data-qa-id": "aditem_container"}
        )

        product_urls = []

        for article in ad_articles:
            anchor = article.find("a")
            relative_url = anchor["href"].strip("/")
            product_url = f"https://www.leboncoin.fr/{relative_url}"
            product_urls.append(product_url)

        return product_urls
