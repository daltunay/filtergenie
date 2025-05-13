import pytest
from bs4 import BeautifulSoup

from backend.analyzer.models import ItemModel
from backend.scraper import scrape_item
from backend.scraper.platforms.ebay import EbayScraper
from backend.scraper.platforms.leboncoin import LeboncoinScraper
from backend.scraper.platforms.vinted import VintedScraper


@pytest.mark.parametrize(
    "scraper, html, expected_title, expected_images, expected_desc",
    [
        (
            VintedScraper,
            '<span class="web_ui__Text__title">Vinted Title</span>'
            '<div class="item-photos"><img src="img1.jpg"><img src="img2.jpg"></div>'
            '<div itemprop="description"><span class="web_ui__Text__text">Vinted desc</span></div>',
            "Vinted Title",
            ["img1.jpg", "img2.jpg"],
            {"description": "Vinted desc"},
        ),
        (
            LeboncoinScraper,
            '<h1 class="text-headline-1-expanded" data-qa-id="adview_title">LBC Title</h1>'
            '<div class="slick-list">'
            '  <div class="slick-slide"><picture><img src="lbc1.jpg"></picture></div>'
            '  <div class="slick-slide"><picture><img src="lbc2.jpg"></picture></div>'
            "</div>"
            '<div data-qa-id="adview_description_container"><p>LBC desc</p></div>',
            "LBC Title",
            ["lbc1.jpg", "lbc2.jpg"],
            {"description": "LBC desc"},
        ),
        (
            EbayScraper,
            '<h1 class="x-item-title__mainTitle"><span class="ux-textspans">Ebay Title</span></h1>'
            '<div class="ux-image-grid no-scrollbar">'
            '  <img src="ebay1.jpg">'
            '  <img src="ebay2.jpg">'
            "</div>",
            "Ebay Title",
            ["ebay1.jpg", "ebay2.jpg"],
            {},
        ),
    ],
)
def test_scraper_extract_methods(scraper, html, expected_title, expected_images, expected_desc):
    soup = BeautifulSoup(html, "html.parser")
    assert scraper.extract_title(soup) == expected_title
    assert scraper.extract_images(soup) == expected_images
    if hasattr(scraper, "extract_description"):
        assert scraper.extract_description(soup) == expected_desc


def test_scrape_item_vinted():
    html = (
        '<span class="web_ui__Text__title">Vinted Title</span>'
        '<div class="item-photos"><img src="img1.jpg"><img src="img2.jpg"></div>'
        '<div itemprop="description"><span class="web_ui__Text__text">Vinted desc</span></div>'
    )
    item = scrape_item("vinted", "http://foo", html)
    assert isinstance(item, ItemModel)
    assert item.title == "Vinted Title"
    assert item.platform == "vinted"
    assert item.url == "http://foo"
    assert len(item.images) == 2
    assert item.images[0].url == "img1.jpg"
    assert item.images[1].url == "img2.jpg"
    assert item.model_extra["description"] == "Vinted desc"


def test_scrape_item_leboncoin():
    html = (
        '<h1 class="text-headline-1-expanded" data-qa-id="adview_title">LBC Title</h1>'
        '<div class="slick-list">'
        '  <div class="slick-slide"><picture><img src="lbc1.jpg"></picture></div>'
        '  <div class="slick-slide"><picture><img src="lbc2.jpg"></picture></div>'
        "</div>"
        '<div data-qa-id="adview_description_container"><p>LBC desc</p></div>'
    )
    item = scrape_item("leboncoin", "http://foo", html)
    assert isinstance(item, ItemModel)
    assert item.title == "LBC Title"
    assert item.platform == "leboncoin"
    assert item.url == "http://foo"
    assert len(item.images) == 2
    assert item.images[0].url == "lbc1.jpg"
    assert item.images[1].url == "lbc2.jpg"
    assert item.model_extra["description"] == "LBC desc"


def test_scrape_item_ebay():
    html = (
        '<h1 class="x-item-title__mainTitle"><span class="ux-textspans">Ebay Title</span></h1>'
        '<div class="ux-image-grid no-scrollbar">'
        '  <img src="ebay1.jpg">'
        '  <img src="ebay2.jpg">'
        "</div>"
    )
    item = scrape_item("ebay", "http://foo", html)
    assert isinstance(item, ItemModel)
    assert item.title == "Ebay Title"
    assert item.platform == "ebay"
    assert item.url == "http://foo"
    assert len(item.images) == 2
    assert item.images[0].url == "ebay1.jpg"
    assert item.images[1].url == "ebay2.jpg"
