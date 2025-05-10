from bs4 import BeautifulSoup

from backend.scraper.base import BaseScraper


class LeboncoinScraper(BaseScraper):
    @classmethod
    def extract_title(cls, soup: BeautifulSoup) -> str:
        title_elem = soup.find(
            "h1",
            class_="text-headline-1-expanded",
            attrs={"data-qa-id": "adview_title"},
        )
        return title_elem.text.strip() if title_elem else ""

    @classmethod
    def extract_images(cls, soup: BeautifulSoup) -> list[str]:
        image_urls = []
        seen_urls = set()
        gallery_section = soup.find("div", class_="slick-list")
        if gallery_section:
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

    @classmethod
    def extract_description(cls, soup: BeautifulSoup) -> dict[str, str]:
        desc_container = soup.find("div", attrs={"data-qa-id": "adview_description_container"})
        desc_elem = desc_container.find("p") if desc_container else None
        description = desc_elem.text.strip() if desc_elem else ""
        return {"description": description}
