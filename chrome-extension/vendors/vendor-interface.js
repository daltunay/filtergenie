// Vendor Interface - defines the standard structure for all vendor modules

// Global registry for vendor implementations
window.SmartFilterVendors = window.SmartFilterVendors || {};

/**
 * Base vendor interface that all vendors should implement
 */
class VendorInterface {
  // Vendor name displayed in the UI
  name = "Unknown Vendor";

  // Array of regex patterns that match search page URLs
  searchPatterns = [];

  // Default filters for this vendor
  defaultFilters = ["Is this a good deal?"];

  // Check if the current URL is a supported search page
  isSearchPage(url) {
    const pathname = new URL(url).pathname;
    return this.searchPatterns.some((pattern) => pathname.match(pattern));
  }

  // Get product items from the page
  getProductItems() {
    throw new Error("getProductItems must be implemented by vendor");
  }

  // Extract full URL from a link element
  extractUrl(link) {
    throw new Error("extractUrl must be implemented by vendor");
  }

  // Find the container where badges should be placed
  findImageContainer(item) {
    throw new Error("findImageContainer must be implemented by vendor");
  }
}

// Register a vendor implementation
function registerVendor(hostname, implementation) {
  if (!(implementation.prototype instanceof VendorInterface)) {
    console.error(
      `Vendor for ${hostname} doesn't properly implement VendorInterface`,
    );
    return;
  }

  window.SmartFilterVendors[hostname] = implementation;
}
