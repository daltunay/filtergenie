/**
 * SmartFilter - Vendor Interface
 */
window.SmartFilterVendors = window.SmartFilterVendors || {};

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
    console.error(`Invalid vendor implementation for ${hostname}`);
    return;
  }
  window.SmartFilterVendors[hostname] = implementation;
}
