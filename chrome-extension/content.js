/**
 * SmartFilter - Content Script Entry Point
 */
(function () {
  let smartFilterInstance = null;

  function init() {
    const vendor = detectVendor();
    if (!vendor) return;

    console.log(`SmartFilter: Initializing on ${vendor.name}`);
    smartFilterInstance = new SmartFilterCore(vendor);
  }

  function detectVendor() {
    const hostname = window.location.hostname;

    for (const [domain, VendorClass] of Object.entries(
      window.SmartFilterVendors,
    )) {
      if (hostname.includes(domain)) {
        const vendor = new VendorClass();
        return vendor.isSearchPage(window.location.href) ? vendor : null;
      }
    }
    return null;
  }

  const messageHandlers = {
    getVendorInfo: () => {
      const vendor = detectVendor();
      return vendor
        ? { success: true, vendor: { name: vendor.name } }
        : { success: false };
    },

    getFilterState: () => {
      if (!smartFilterInstance)
        return { success: false, error: "Not initialized" };

      return {
        success: true,
        isApplied: smartFilterInstance.filteredProducts !== null,
        matched: smartFilterInstance.lastResults.matched,
        total: smartFilterInstance.lastResults.total,
      };
    },

    updateFilterThreshold: (request) => {
      if (!smartFilterInstance?.filteredProducts)
        return { success: false, error: "No active filters" };

      const result = smartFilterInstance.updateFilterThreshold(
        request.filterThreshold,
      );
      return { success: true, ...result };
    },

    applyFilters: async (request) => {
      try {
        return await smartFilterInstance.applyFilters(
          request.filters,
          request.maxItems,
          request.filterThreshold,
        );
      } catch (error) {
        return { success: false, error: error.message };
      }
    },

    resetFilters: () => {
      if (!smartFilterInstance)
        return { success: false, error: "Not initialized" };

      smartFilterInstance.resetFiltering();
      return { success: true };
    },
  };

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const handler = messageHandlers[request.action];

    if (!handler) {
      sendResponse({ success: false, error: "Unknown action" });
      return true;
    }

    if (!smartFilterInstance && request.action !== "getVendorInfo") {
      init();
      if (!smartFilterInstance) {
        sendResponse({ success: false, error: "Not supported" });
        return true;
      }
    }

    const response = handler(request);
    if (response instanceof Promise) {
      response.then(sendResponse);
      return true;
    } else {
      sendResponse(response);
      return true;
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
