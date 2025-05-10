from abc import ABC, abstractmethod

from bs4 import BeautifulSoup


class BaseScraper(ABC):
    """Abstract base class for all platform scrapers."""

    @classmethod
    @abstractmethod
    def extract_title(cls, soup: BeautifulSoup) -> str:
        pass

    @classmethod
    @abstractmethod
    def extract_images(cls, soup: BeautifulSoup) -> list[str]:
        pass

    @classmethod
    def extract_extra(cls, soup: BeautifulSoup) -> dict[str, str]:
        """Return all additional fields as a dict (e.g. description, price, etc.)."""
        return cls.gather_extras(soup)

    @classmethod
    def parse_item(cls, html: str) -> dict:
        soup = BeautifulSoup(html, "html.parser")
        data = {
            "title": cls.extract_title(soup),
            "images": [{"url": url} for url in cls.extract_images(soup)],
        }
        data.update(cls.extract_extra(soup))
        return data

    @classmethod
    def gather_extras(cls, soup: BeautifulSoup) -> dict[str, str]:
        """Utility to gather all extract_xxx methods (except title/images/extra) and merge their results."""
        EXCLUDE = {"extract_title", "extract_images", "extract_extra"}
        extras = {}
        for attr in dir(cls):
            if attr.startswith("extract_") and attr not in EXCLUDE:
                method = getattr(cls, attr)
                if callable(method):
                    result = method(soup)
                    extras.update(result)
        return extras
