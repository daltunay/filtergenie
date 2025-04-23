(function () {
  let smartFilterInstance = null;

  function init() {
    const platform = detectPlatform();
    if (platform) {
      smartFilterInstance = new SmartFilterCore(platform);
    }
  }

  function detectPlatform() {
    const hostname = window.location.hostname;
    const platformEntry = Object.entries(window.SmartFilterPlatforms).find(
      ([domain]) => hostname.includes(domain),
    );

    if (!platformEntry) return null;

    const [_, PlatformClass] = platformEntry;
    const platform = new PlatformClass();
    return platform.detectPageType(window.location.href) ? platform : null;
  }

  const messageHandlers = {
    getPlatformInfo: () => {
      const platform = detectPlatform();
      return platform
        ? {
            success: true,
            platform: { name: platform.name, pageType: platform.pageType },
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

    if (!smartFilterInstance && action !== "getPlatformInfo") {
      sendResponse({ success: false, error: "Not supported" });
      return true;
    }

    Promise.resolve(handler(request))
      .then(sendResponse)
      .catch((error) => sendResponse({ success: false, error: error.message }));

    return true;
  });
})();
