/**
 * Smart E-commerce Filter - Content Script
 *
 * This is the main entry point for the extension on supported websites.
 * It handles:
 * - Vendor detection for the current page
 * - Initialization of the filter core functionality
 * - Message handling from popup and background scripts
 * - Auto-reapplication of filters on page load
 */

(function () {
  let smartFilterInstance = null;

  function detectVendor() {
    const hostname = window.location.hostname;

    for (const [domain, vendorClass] of Object.entries(
      window.SmartFilterVendors,
    )) {
      if (hostname.includes(domain)) {
        const vendor = new vendorClass();

        if (vendor.isSearchPage(window.location.href)) {
          return vendor;
        }
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

    await reapplyStoredFilters();
  }

  async function reapplyStoredFilters() {
    if (!smartFilterInstance) return;

    try {
      const hostname = window.location.hostname;

      const stored = await chrome.storage.local.get([
        `filters_${hostname}`,
        `settings_${hostname}`,
        `lastApplied_${hostname}`,
      ]);

      const filters = stored[`filters_${hostname}`];
      const settings = stored[`settings_${hostname}`];
      const lastApplied = stored[`lastApplied_${hostname}`];

      if (filters?.length > 0 && lastApplied) {
        console.log("Smart Filter: Auto-reapplying stored filters", filters);

        const maxItems = settings?.maxItems || 5;
        const hideNonMatching = settings?.hideNonMatching || false;

        await smartFilterInstance.applyFilters(
          filters,
          maxItems,
          hideNonMatching,
        );
      }
    } catch (error) {
      console.error("Failed to reapply stored filters:", error);
    }
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!smartFilterInstance && request.action !== "getVendorInfo") {
      init();
      if (!smartFilterInstance) {
        sendResponse({ success: false, error: "Not a supported page" });
        return true;
      }
    }

    switch (request.action) {
      case "getVendorInfo":
        const vendor = detectVendor();
        sendResponse(
          vendor
            ? {
                success: true,
                vendor: { name: vendor.name },
                defaultFilters: vendor.defaultFilters || [],
              }
            : { success: false },
        );
        break;

      case "getFilterState":
        if (!smartFilterInstance) {
          sendResponse({ success: false, error: "Filter not initialized" });
          break;
        }

        sendResponse({
          success: true,
          isApplied: smartFilterInstance.filteredProducts !== null,
          matched: smartFilterInstance.lastResults.matched,
          total: smartFilterInstance.lastResults.total,
        });
        break;

      case "updateHideMode":
        if (smartFilterInstance?.filteredProducts) {
          smartFilterInstance.updateHideMode(request.hideNonMatching);
          sendResponse({ success: true });
        } else {
          sendResponse({
            success: false,
            error: "No active filters to update",
          });
        }
        break;

      case "applyFilters":
        smartFilterInstance
          .applyFilters(
            request.filters,
            request.maxItems,
            request.hideNonMatching,
          )
          .then(sendResponse)
          .catch((error) => {
            sendResponse({
              success: false,
              error: error.message || "Error applying filters",
            });
          });
        return true;

      case "resetFilters":
        if (smartFilterInstance) {
          smartFilterInstance.resetFiltering();
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: "Filter not initialized" });
        }
        break;

      default:
        sendResponse({ success: false, error: "Unknown action" });
    }

    return true;
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
