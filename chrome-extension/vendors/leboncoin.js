// LeBonCoin vendor implementation

class LeboncoinVendor extends VendorInterface {
  name = "LeBonCoin";
  searchPatterns = [/\/(recherche|c)(\/|$)/];
  defaultFilters = ["Is this in excellent condition?", "Is this a good deal?"];

  getProductItems() {
    return document.querySelectorAll('article[data-test-id="ad"]');
  }

  extractUrl(link) {
    const href = link.getAttribute("href");
    return href.startsWith("http")
      ? href
      : `https://www.leboncoin.fr${href.startsWith("/") ? href : `/${href}`}`;
  }

  findImageContainer(item) {
    return item.querySelector("img")?.closest("div") || item;
  }
}

// Register this vendor
registerVendor("leboncoin.fr", LeboncoinVendor);
