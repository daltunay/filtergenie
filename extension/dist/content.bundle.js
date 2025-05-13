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

  // extension/utils/spinnerUtils.js
  var SPINNER_FRAMES = [
    "\u280B",
    "\u2819",
    "\u281A",
    "\u281E",
    "\u2816",
    "\u2826",
    "\u2834",
    "\u2832",
    "\u2833",
    "\u2813",
    "\u280B",
    "\u2819",
    "\u281A",
    "\u281E",
    "\u2816",
    "\u2826",
    "\u2834",
    "\u2832",
    "\u2833",
    "\u2813"
  ];
  var itemSpinnerIntervals = /* @__PURE__ */ new WeakMap();
  var itemElapsedIntervals = /* @__PURE__ */ new WeakMap();
  function showItemSpinner(targets) {
    targets.forEach((el) => {
      if (!el) return;
      let statusDiv = el.querySelector(".filtergenie-status");
      if (!statusDiv) {
        statusDiv = document.createElement("div");
        statusDiv.className = "filtergenie-status";
        el.insertBefore(statusDiv, el.firstChild);
      }
      statusDiv.style.display = "";
      statusDiv.textContent = "";
      if (itemSpinnerIntervals.has(statusDiv)) {
        clearInterval(itemSpinnerIntervals.get(statusDiv));
      }
      if (itemElapsedIntervals.has(statusDiv)) {
        clearInterval(itemElapsedIntervals.get(statusDiv));
      }
      let frame = 0;
      const start = Date.now();
      let elapsed = 0;
      function updateFrame() {
        statusDiv.textContent = `${SPINNER_FRAMES[frame]} (${elapsed.toFixed(1)}s)`;
        frame = (frame + 1) % SPINNER_FRAMES.length;
      }
      function updateElapsed() {
        elapsed = (Date.now() - start) / 1e3;
      }
      updateElapsed();
      updateFrame();
      const interval = setInterval(updateFrame, 350);
      const elapsedInterval = setInterval(updateElapsed, 30);
      itemSpinnerIntervals.set(statusDiv, interval);
      itemElapsedIntervals.set(statusDiv, elapsedInterval);
    });
  }
  function removeItemSpinner(targets) {
    targets.forEach((el) => {
      if (!el) return;
      const statusDiv = el.querySelector(".filtergenie-status");
      if (statusDiv && itemSpinnerIntervals.has(statusDiv)) {
        clearInterval(itemSpinnerIntervals.get(statusDiv));
        itemSpinnerIntervals.delete(statusDiv);
      }
      if (statusDiv && itemElapsedIntervals.has(statusDiv)) {
        clearInterval(itemElapsedIntervals.get(statusDiv));
        itemElapsedIntervals.delete(statusDiv);
      }
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
    if (!document.getElementById("filtergenie-status-style")) {
      const style = document.createElement("style");
      style.id = "filtergenie-status-style";
      style.textContent = `
      .filtergenie-status {
        display: flex !important;
        width: 100% !important;
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        background: none !important;
        border: none !important;
        z-index: 10;
        overflow: visible !important;
        position: relative;
        min-height: 0;
      }
      .filtergenie-status .filtergenie-status-block {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: flex-start;
        width: 100%;
        row-gap: 6px;
      }
    `;
      document.head.appendChild(style);
    }
    const platform = getPlatform();
    items.forEach((item, idx) => {
      const filterResults = filtersData[idx] || {};
      const matchCount = Object.values(filterResults).filter(Boolean).length;
      const container = platform ? platform.getItemContainer(item) : item;
      let statusDiv = container.querySelector(".filtergenie-status");
      if (!statusDiv) {
        statusDiv = document.createElement("div");
        statusDiv.className = "filtergenie-status";
        container.appendChild(statusDiv);
      }
      const ordered = Object.entries(filterResults).sort(
        ([a], [b]) => a.localeCompare(b)
      );
      statusDiv.innerHTML = '<div class="filtergenie-status-block">' + ordered.map(
        ([desc, matched]) => `<span style="display:inline-flex;align-items:center;padding:2px 8px;border-radius:8px;font-size:13px;${matched ? "background:rgba(34,197,94,0.13);color:#4ade80;" : "background:rgba(239,68,68,0.13);color:#f87171;"}margin-bottom:2px;max-width:100%;word-break:break-word;">${matched ? "\u2705" : "\u274C"} <span style='margin-left:5px;'>${desc}</span></span>`
      ).join("") + "</div>";
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
      const sortedFilters = [...filters].sort((a, b) => a.localeCompare(b));
      const data = await callApiAnalyze(
        itemSources,
        sortedFilters,
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
