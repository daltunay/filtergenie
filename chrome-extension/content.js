// Main entry point for Smart Filter extension

(function () {
  // Detect current vendor
  function detectVendor() {
    const hostname = window.location.hostname;

    // Extract the base domain (e.g., "leboncoin.fr" from "www.leboncoin.fr")
    const baseDomain = hostname.split(".").slice(-2).join(".");

    // Find vendor implementation
    for (const [domain, vendorClass] of Object.entries(
      window.SmartFilterVendors,
    )) {
      if (hostname.includes(domain)) {
        const vendor = new vendorClass();

        // Check if current page is a search page
        if (vendor.isSearchPage(window.location.href)) {
          return vendor;
        }
      }
    }

    return null;
  }

  // Initialize the extension
  function init() {
    // Get the appropriate vendor
    const vendor = detectVendor();

    if (!vendor) {
      console.log("Smart Filter: Not a supported page");
      return;
    }

    console.log(`Smart Filter: Initializing on ${vendor.name} search page`);

    // Create and initialize the core module with the detected vendor
    const smartFilter = new SmartFilterCore(vendor);
    smartFilter.init();
  }

  // Wait for the DOM to be fully loaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
