from bs4 import BeautifulSoup

from ..base import BaseScraper


class EbayScraper(BaseScraper):
    """Scraper for eBay."""

    SUPPORTED_DOMAINS = ["ebay.com", "ebay.fr"]

    PAGE_TYPE_PATTERNS = {
        "product": ["/itm/"],
        "search": ["/sch/", "/b/"],
    }

    @staticmethod
    def extract_product_id(url: str) -> int:
        return int(url.split("?")[0].split("/")[-1])

    @staticmethod
    def extract_product_title(soup: BeautifulSoup) -> str:
        title_elem = soup.find("h1", class_="x-item-title__mainTitle")
        title_span = title_elem.find("span", class_="ux-textspans")
        return title_span.text.strip()

    @staticmethod
    def extract_product_description(soup: BeautifulSoup) -> str:
        # Try multiple possible selectors for eBay description
        selectors = [
            "div#ds_div",
            "div.itemAttr",
            "div.item-description",
            'div[data-testid="x-item-details-section"]',
        ]

        for selector in selectors:
            desc_element = soup.select_one(selector)
            if desc_element:
                return desc_element.get_text(strip=True, separator=" ")

        # Fallback - try to find any structured description
        specs = soup.select(
            "div.ux-layout-section__item .ux-labels-values__labels, .ux-labels-values__values"
        )
        if specs:
            return " ".join([s.get_text(strip=True) for s in specs])

        return ""

    @staticmethod
    def extract_product_images(soup: BeautifulSoup) -> list[str]:
        image_urls = []
        image_container = soup.find("div", class_="ux-image-grid no-scrollbar")
        img_elements = image_container.find_all("img")
        for img in img_elements:
            if image_url := (img.get("src") or img.get("data-src")):
                image_urls.append(image_url)
        return image_urls

    @staticmethod
    def extract_product_urls(soup: BeautifulSoup) -> list[str]:
        product_urls = []

        # Find search results items
        item_links = soup.select(
            "li.s-item a.s-item__link, div.srp-results a.s-item__link"
        )

        for link in item_links:
            href = link.get("href")
            if href and "/itm/" in href:
                product_urls.append(href)

        return product_urls
