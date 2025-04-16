/**
 * Smart E-commerce Filter - Content Script
 */

(function () {
  let smartFilterInstance = null;

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

  async function init() {
    const vendor = detectVendor();

    if (!vendor) {
      console.log("Smart Filter: Not a supported page");
      return;
    }

    console.log(`Smart Filter: Initializing on ${vendor.name} search page`);
    smartFilterInstance = new SmartFilterCore(vendor);
    
    // Load filter state but don't automatically apply filters
    await loadFilterState();
  }

  // Renamed from reapplyStoredFilters to loadFilterState
  async function loadFilterState() {
    if (!smartFilterInstance) return;

    try {
      const hostname = window.location.hostname;
      const stored = await chrome.storage.local.get([
        `filters_${hostname}`,
        `settings_${hostname}`,
        `lastApplied_${hostname}`,
      ]);

      // Only load the state but don't apply filters automatically
      console.log("Smart Filter: Filter state loaded but not applied automatically");
      
      // Send a message to the popup to indicate we're ready
      try {
        chrome.runtime.sendMessage({
          action: "contentScriptReady",
          hostname: hostname
        });
      } catch (error) {
        // Popup might not be open, which is fine
      }
    } catch (error) {
      console.error("Failed to load filter state:", error);
    }
  }

  const messageHandlers = {
    getVendorInfo: () => {
      const vendor = detectVendor();
      return vendor
        ? {
            success: true,
            vendor: { name: vendor.name },
            defaultFilters: vendor.defaultFilters || [],
          }
        : { success: false };
    },

    getFilterState: () => {
      if (!smartFilterInstance)
        return { success: false, error: "Filter not initialized" };

      return {
        success: true,
        isApplied: smartFilterInstance.filteredProducts !== null,
        matched: smartFilterInstance.lastResults.matched,
        total: smartFilterInstance.lastResults.total,
      };
    },

    updateHideMode: (request) => {
      if (!smartFilterInstance?.filteredProducts)
        return { success: false, error: "No active filters to update" };

      smartFilterInstance.updateHideMode(request.hideNonMatching);
      return { success: true };
    },

    applyFilters: async (request) => {
      try {
        return await smartFilterInstance.applyFilters(
          request.filters,
          request.maxItems,
          request.hideNonMatching,
        );
      } catch (error) {
        return {
          success: false,
          error: error.message || "Error applying filters",
        };
      }
    },

    resetFilters: () => {
      if (!smartFilterInstance)
        return { success: false, error: "Filter not initialized" };

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
        sendResponse({ success: false, error: "Not a supported page" });
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
