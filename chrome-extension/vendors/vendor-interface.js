/**
 * Smart E-commerce Filter - Vendor Interface
 *
 * This module defines the base interface that all vendor-specific
 * implementations must follow. It provides:
 * - A registry for vendor implementations
 * - Common methods for detecting search pages
 * - Abstract methods that vendors must implement
 */

window.SmartFilterVendors = window.SmartFilterVendors || {};

window.DEFAULT_FILTERS = [
  "Is this in excellent condition?",
  "Is this a good deal?",
  "Does this look authentic?",
];

/**
 * Base vendor interface that all vendors should implement
 */
class VendorInterface {
  name = "Unknown Vendor";

  searchPatterns = [];

  isSearchPage(url) {
    const pathname = new URL(url).pathname;
    return this.searchPatterns.some((pattern) => pathname.match(pattern));
  }

  getProductItems() {
    throw new Error("getProductItems must be implemented by vendor");
  }

  extractUrl(link) {
    throw new Error("extractUrl must be implemented by vendor");
  }

  findImageContainer(item) {
    throw new Error("findImageContainer must be implemented by vendor");
  }
}

function registerVendor(hostname, implementation) {
  if (!(implementation.prototype instanceof VendorInterface)) {
    console.error(
      `Vendor for ${hostname} doesn't properly implement VendorInterface`,
    );
    return;
  }

  window.SmartFilterVendors[hostname] = implementation;
}
