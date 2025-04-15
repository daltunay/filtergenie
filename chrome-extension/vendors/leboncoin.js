/**
 * Smart E-commerce Filter - LeBonCoin Vendor Implementation
 *
 * This vendor module provides site-specific functionality for LeBonCoin.fr.
 * It handles:
 * - Search page detection
 * - Product item extraction
 * - URL normalization
 * - UI element location
 */

class LeboncoinVendor extends VendorInterface {
  name = "LeBonCoin";
  searchPatterns = [/\/(recherche|c)(\/|$)/];

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

registerVendor("leboncoin.fr", LeboncoinVendor);
