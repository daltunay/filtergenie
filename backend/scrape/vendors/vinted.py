from bs4 import BeautifulSoup

from backend.scrape.base import BaseScraper


class VintedScraper(BaseScraper):
    """Scraper for Vinted."""

    SUPPORTED_DOMAINS = ["vinted.fr", "vinted.com"]

    PAGE_TYPE_PATTERNS = {
        "product": ["/items/"],
        "search": ["/catalog"],
    }

    @staticmethod
    def extract_product_id(url: str) -> int:
        return int(url.split("/")[-1].split("-")[0])

    @staticmethod
    def extract_product_title(soup: BeautifulSoup) -> str:
        title_elem = soup.find("span", class_="web_ui__Text__title")
        return title_elem.text.strip() if title_elem else ""

    @staticmethod
    def extract_product_description(soup: BeautifulSoup) -> str:
        desc_container = soup.find("div", attrs={"itemprop": "description"})
        desc_text = desc_container.find("span", class_="web_ui__Text__text")
        return desc_text.text.strip()

    @staticmethod
    def extract_product_images(soup: BeautifulSoup) -> list[str]:
        photos_container = soup.find("div", class_="item-photos")
        img_elements = photos_container.find_all("img")
        image_urls = []
        for img in img_elements:
            image_urls.append(img["src"])
        return image_urls

    @staticmethod
    def extract_product_urls(soup: BeautifulSoup) -> list[str]:
        product_urls = []

        # Look for catalog items in search results
        catalog_items = soup.select(
            ".feed-grid__item .feed-grid__item__content a, .catalog-grid .catalog-grid__item a"
        )

        for item in catalog_items:
            href = item.get("href")
            if href and "/items/" in href:
                # Make absolute URL if it's relative
                if href.startswith("/"):
                    product_url = f"https://www.vinted.fr{href}"
                elif href.startswith("http"):
                    product_url = href
                else:
                    product_url = f"https://www.vinted.fr/{href}"

                product_urls.append(product_url)

        return product_urls
