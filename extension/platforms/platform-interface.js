window.SmartFilterPlatforms = window.SmartFilterPlatforms || {};

class PlatformInterface {
  name = "Unknown Platform";
  searchPatterns = [];
  pageType = null;

  detectPageType(url) {
    if (this.isSearchPage(url)) {
      this.pageType = "search";
      return true;
    }

    if (this.isItemPage(url)) {
      this.pageType = "item";
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

  isItemPage(url) {
    return false;
  }

  getItemItems() {
    throw new Error("Method not implemented");
  }

  extractUrl(link) {
    throw new Error("Method not implemented");
  }

  findImageContainer(item) {
    throw new Error("Method not implemented");
  }
}

function registerPlatform(hostname, implementation) {
  if (!(implementation.prototype instanceof PlatformInterface)) {
    console.error(`Invalid platform implementation for ${hostname}`);
    return;
  }
  window.SmartFilterPlatforms[hostname] = implementation;
}
