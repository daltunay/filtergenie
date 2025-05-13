(() => {
  // extension/utils/platformRegistry.js
  function parseUrl(url) {
    try {
      return new URL(url);
    } catch (e) {
      return null;
    }
  }
  var Platform = class {
    constructor(config) {
      this.name = config.name;
      this._config = config;
    }
    isSupported(url) {
      const parsed = parseUrl(url);
      return parsed && this._config.hostPattern.test(parsed.hostname);
    }
    isSearchPage(url) {
      const parsed = parseUrl(url);
      return parsed && this._config.searchPathPatterns.some((pat) => pat.test(parsed.pathname));
    }
    isItemPage(url) {
      const parsed = parseUrl(url);
      return parsed && this._config.itemPathPattern.test(parsed.pathname);
    }
    getItemElements() {
      return document.querySelectorAll(this._config.itemSelector);
    }
    getItemUrl(item) {
      if (typeof this._config.getItemUrl === "function") {
        return this._config.getItemUrl(item);
      }
      const link = item.querySelector(this._config.itemLinkSelector);
      return (link == null ? void 0 : link.getAttribute("href")) || null;
    }
    async getItemHtml(item) {
      const url = this.getItemUrl(item);
      if (!url) return "";
      try {
        const resp = await fetch(url, { credentials: "include" });
        return await resp.text();
      } catch (e) {
        return "";
      }
    }
    getItemContainer(item) {
      return item;
    }
  };
  var PlatformRegistry = class {
    constructor() {
      this._platforms = [];
    }
    registerPlatform(config) {
      if (config == null ? void 0 : config.name) this._platforms.push(new Platform(config));
    }
    getCurrentPlatform(url) {
      if (!url) return null;
      return this._platforms.find((p) => p.isSupported(url)) || null;
    }
    isCurrentPageSearchPage(url) {
      const platform = this.getCurrentPlatform(url);
      return !!(platform && platform.isSearchPage(url));
    }
    getAllPlatforms() {
      return this._platforms;
    }
  };
  var platformRegistry = new PlatformRegistry();

  // extension/platforms/leboncoin.js
  var leboncoinConfig = {
    name: "leboncoin",
    hostPattern: /leboncoin\.fr$/,
    searchPathPatterns: [/^\/recherche/, /^\/c\//],
    itemPathPattern: /\/ad\//,
    itemSelector: 'article[data-test-id="ad"]',
    itemLinkSelector: 'a.absolute.inset-0[href^="/ad/"]',
    baseUrl: "https://www.leboncoin.fr",
    getItemUrl(item) {
      const link = item.querySelector('a.absolute.inset-0[href^="/ad/"]');
      const href = link == null ? void 0 : link.getAttribute("href");
      if (!href) return null;
      return href.startsWith("http") ? href : `${this.baseUrl}${href.startsWith("/") ? href : `/${href}`}`;
    }
  };
  platformRegistry.registerPlatform(leboncoinConfig);

  // extension/platforms/vinted.js
  var vintedConfig = {
    name: "vinted",
    hostPattern: /vinted\.fr$/,
    searchPathPatterns: [/^\/catalog/, /^\/c\//],
    itemPathPattern: /^\/items\//,
    itemSelector: 'div.new-item-box__container[data-testid^="product-item-id-"]',
    itemLinkSelector: 'a.new-item-box__overlay[data-testid$="--overlay-link"][href^="https://www.vinted.fr/items/"]',
    baseUrl: "https://www.vinted.fr",
    getItemUrl(item) {
      const link = item.querySelector(
        'a.new-item-box__overlay[data-testid$="--overlay-link"][href^="https://www.vinted.fr/items/"]'
      );
      const href = link == null ? void 0 : link.getAttribute("href");
      if (!href) return null;
      return href.startsWith("http") ? href : `${this.baseUrl}${href.startsWith("/") ? href : `/${href}`}`;
    }
  };
  platformRegistry.registerPlatform(vintedConfig);

  // extension/popup/components/ui-components.js
  function createSpinner(size = "sm") {
    const spinnerSizes = {
      sm: "h-4 w-4",
      md: "h-6 w-6",
      lg: "h-8 w-8"
    };
    const spinner = document.createElement("span");
    spinner.className = `inline-block align-middle ${spinnerSizes[size] || spinnerSizes.sm} animate-spin`;
    spinner.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-full h-full">
    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>`;
    return spinner;
  }

  // extension/utils/spinnerUtils.js
  function showItemSpinner(targets) {
    targets.forEach((el) => {
      if (!el) return;
      const prev = el.querySelector(".filtergenie-spinner-container");
      if (prev) prev.remove();
      const spinner = document.createElement("span");
      spinner.className = "filtergenie-spinner-container inline-flex items-center animate-fade-in";
      spinner.appendChild(createSpinner("sm"));
      el.appendChild(spinner);
    });
  }
  function removeItemSpinner(targets) {
    targets.forEach((el) => {
      if (!el) return;
      const spinner = el.querySelector(".filtergenie-spinner-container");
      if (spinner) spinner.remove();
      const statusContent = el.querySelector(".filtergenie-status");
      if (statusContent) statusContent.style.display = "";
    });
  }

  // extension/src/content.js
  function getPlatform() {
    var _a;
    const reg = platformRegistry;
    const url = window.location.href;
    if (!reg || !((_a = reg._platforms) == null ? void 0 : _a.length)) return null;
    return reg.getCurrentPlatform(url);
  }
  async function fetchItemSources(platform, items) {
    return Promise.all(
      items.map(async (item) => ({
        platform: platform.name,
        url: platform.getItemUrl(item),
        html: await platform.getItemHtml(item)
      }))
    );
  }
  async function callApiAnalyze(items, filters, apiEndpoint, apiKey) {
    const headers = { "Content-Type": "application/json" };
    if (apiKey) headers["X-API-Key"] = apiKey;
    apiEndpoint = apiEndpoint.replace(/\/+$/, "");
    try {
      const resp = await fetch(`${apiEndpoint}/items/analyze`, {
        method: "POST",
        headers,
        body: JSON.stringify({ items, filters })
      });
      return resp.json();
    } catch (e) {
      throw e;
    }
  }
  function updateItemStatus(items, filtersData, minMatch) {
    items.forEach((item, idx) => {
      const filterResults = filtersData[idx] || {};
      const matchCount = Object.values(filterResults).filter(Boolean).length;
      let statusDiv = item.querySelector(".filtergenie-status");
      if (!statusDiv) {
        statusDiv = document.createElement("div");
        statusDiv.className = "filtergenie-status";
        item.appendChild(statusDiv);
      }
      statusDiv.style.display = "";
      statusDiv.innerHTML = Object.entries(filterResults).map(([desc, matched]) => `${matched ? "\u2705" : "\u274C"} ${desc}`).join("<br>");
      item.style.display = matchCount >= minMatch ? "" : "none";
    });
  }
  async function analyzeItems(filters, minMatch, platform, maxItems, sendResponse, apiEndpoint, apiKey) {
    if (!platform) return;
    const items = Array.from(platform.getItemElements()).slice(0, maxItems);
    if (!items.length) return;
    items.forEach((item) => {
      let div = item.querySelector(".filtergenie-status");
      if (!div) {
        div = document.createElement("div");
        div.className = "filtergenie-status";
        item.appendChild(div);
      }
      div.style.display = "none";
    });
    showItemSpinner(items);
    try {
      const itemSources = await fetchItemSources(platform, items);
      const data = await callApiAnalyze(
        itemSources,
        filters,
        apiEndpoint,
        apiKey
      );
      removeItemSpinner(items);
      if (data.filters) {
        updateItemStatus(items, data.filters, minMatch);
        chrome.storage.local.set({
          filtergenieLastAnalyzed: {
            filtersData: data.filters,
            minMatch,
            maxItems,
            timestamp: Date.now()
          }
        });
        chrome.runtime.sendMessage({ type: "FILTERS_APPLIED", success: true });
        sendResponse == null ? void 0 : sendResponse({ apiResponse: data });
      } else {
        chrome.runtime.sendMessage({
          type: "FILTERS_APPLIED",
          success: false,
          error: "Invalid response format"
        });
        sendResponse == null ? void 0 : sendResponse({ apiResponse: "Invalid response format" });
      }
    } catch (error) {
      console.error("FilterGenie analysis error:", error);
      removeItemSpinner(items);
      chrome.runtime.sendMessage({
        type: "FILTERS_APPLIED",
        success: false,
        error: "API error"
      });
      sendResponse == null ? void 0 : sendResponse({ apiResponse: "API error" });
    }
  }
  function updateItemVisibility(minMatch, maxItems) {
    const platform = getPlatform();
    if (!platform) return;
    const items = Array.from(platform.getItemElements()).slice(0, maxItems);
    items.forEach((item) => {
      const statusDiv = item.querySelector(".filtergenie-status");
      const matchCount = ((statusDiv == null ? void 0 : statusDiv.textContent.match(/✅/g)) || []).length;
      item.style.display = matchCount >= minMatch ? "" : "none";
    });
  }
  function handleMessage(msg, sender, sendResponse) {
    if (msg.type === "PING") {
      sendResponse({ type: "PONG" });
      return true;
    }
    switch (msg.type) {
      case "APPLY_FILTERS":
        analyzeItems(
          msg.activeFilters,
          msg.minMatch,
          getPlatform(),
          msg.maxItems,
          sendResponse,
          msg.apiEndpoint,
          msg.apiKey
        );
        return true;
      case "UPDATE_MIN_MATCH":
        updateItemVisibility(
          msg.minMatch,
          typeof msg.maxItems === "number" ? msg.maxItems : 10
        );
        return false;
      case "RESET_FILTERS_ON_PAGE":
        document.querySelectorAll(".filtergenie-status").forEach((el) => el.remove());
        return false;
    }
    return false;
  }
  function initializeContentScript() {
    chrome.runtime.onMessage.addListener(handleMessage);
    const platform = getPlatform();
    if (platform && platform.isSearchPage(window.location.href)) {
      chrome.storage.local.get("filtergenieLastAnalyzed", (res) => {
        const last = res.filtergenieLastAnalyzed;
        if (!(last == null ? void 0 : last.filtersData)) return;
        const maxItems = typeof last.maxItems === "number" ? last.maxItems : 10;
        const items = Array.from(platform.getItemElements()).slice(0, maxItems);
        if (!items.length) return;
        updateItemStatus(items, last.filtersData, last.minMatch);
      });
      chrome.storage.local.set({ popupAppliedFilters: [] });
      console.log(
        "FilterGenie: Content script initialized successfully on supported website"
      );
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeContentScript);
  } else {
    initializeContentScript();
  }
})();
