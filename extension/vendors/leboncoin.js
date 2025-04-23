/**
 * SmartFilter - leboncoin Vendor Implementation
 */

class LeboncoinVendor extends VendorInterface {
  name = "leboncoin";
  searchPatterns = [/\/(recherche|c)(\/|$)/];

  isProductPage(url) {
    return new URL(url).pathname.includes("/ad/");
  }

  getProductItems() {
    return document.querySelectorAll('article[data-test-id="ad"]');
  }

  extractUrl(link) {
    const href = link.getAttribute("href");
    if (href.startsWith("http")) return href;
    return `https://www.leboncoin.fr${href.startsWith("/") ? href : `/${href}`}`;
  }

  findImageContainer(item) {
    return item.querySelector("img")?.closest("div") || item;
  }
}

registerVendor("leboncoin.fr", LeboncoinVendor);
