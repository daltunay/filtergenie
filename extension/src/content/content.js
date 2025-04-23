(function () {
  let smartFilterInstance = null;

  function init() {
    const vendor = detectVendor();
    if (vendor) {
      smartFilterInstance = new SmartFilterCore(vendor);
    }
  }

  function detectVendor() {
    const hostname = window.location.hostname;
    const vendorEntry = Object.entries(window.SmartFilterVendors).find(
      ([domain]) => hostname.includes(domain),
    );

    if (!vendorEntry) return null;

    const [_, VendorClass] = vendorEntry;
    const vendor = new VendorClass();
    return vendor.detectPageType(window.location.href) ? vendor : null;
  }

  const messageHandlers = {
    getVendorInfo: () => {
      const vendor = detectVendor();
      return vendor
        ? {
            success: true,
            vendor: { name: vendor.name, pageType: vendor.pageType },
          }
        : { success: false };
    },

    getFilterState: () => {
      if (!smartFilterInstance)
        return { success: false, error: "Not initialized" };
      return {
        success: true,
        isApplied: !!smartFilterInstance.filteredProducts,
        matched: smartFilterInstance.lastResults.matched,
        total: smartFilterInstance.lastResults.total,
      };
    },

    updateFilterThreshold: (request) => {
      if (!smartFilterInstance?.filteredProducts)
        return { success: false, error: "No active filters" };

      return {
        success: true,
        ...smartFilterInstance.updateFilterThreshold(request.filterThreshold),
      };
    },

    applyFilters: (request) =>
      smartFilterInstance.applyFilters(
        request.filters,
        request.maxItems,
        request.filterThreshold,
      ),

    resetFilters: () => {
      if (!smartFilterInstance)
        return { success: false, error: "Not initialized" };
      smartFilterInstance.resetFiltering();
      return { success: true };
    },
  };

  init();

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const { action } = request;
    const handler = messageHandlers[action];

    if (!handler) {
      sendResponse({ success: false, error: "Unknown action" });
      return true;
    }

    if (!smartFilterInstance && action !== "getVendorInfo") {
      sendResponse({ success: false, error: "Not supported" });
      return true;
    }

    Promise.resolve(handler(request))
      .then(sendResponse)
      .catch((error) => sendResponse({ success: false, error: error.message }));

    return true;
  });
})();
