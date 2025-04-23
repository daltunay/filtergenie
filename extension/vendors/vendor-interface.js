window.SmartFilterVendors = window.SmartFilterVendors || {};

class VendorInterface {
  name = "Unknown Vendor";
  searchPatterns = [];
  pageType = null;

  detectPageType(url) {
    if (this.isSearchPage(url)) {
      this.pageType = "search";
      return true;
    }

    if (this.isProductPage(url)) {
      this.pageType = "product";
      return true;
    }

    this.pageType = null;
    return false;
  }

  isSearchPage(url) {
    return this.searchPatterns.some((pattern) =>
      new URL(url).pathname.match(pattern),
    );
  }

  isProductPage(url) {
    return false;
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
