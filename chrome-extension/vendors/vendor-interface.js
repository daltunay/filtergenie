/**
 * Smart E-commerce Filter - Vendor Interface
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
    return this.searchPatterns.some((pattern) =>
      new URL(url).pathname.match(pattern),
    );
  }

  getProductItems() {
    throw new Error("Method not implemented");
  }

  extractUrl(link) {
    throw new Error("Method not implemented");
  }

  findImageContainer(item) {
    throw new Error("Method not implemented");
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
