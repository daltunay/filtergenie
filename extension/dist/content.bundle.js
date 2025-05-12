(() => {
  // extension/utils/platformRegistry.js
  var Platform = class {
    constructor(config) {
      this.name = config.name;
      this._config = config;
    }
    isSupported(url) {
      try {
        return this._config.hostPattern.test(new URL(url).hostname);
      } catch (e) {
        return false;
      }
    }
    isSearchPage(url) {
      try {
        return this._config.searchPathPatterns.some(
          (pat) => pat.test(new URL(url).pathname)
        );
      } catch (e) {
        return false;
      }
    }
    isItemPage(url) {
      try {
        return this._config.itemPathPattern.test(new URL(url).pathname);
      } catch (e) {
        return false;
      }
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
  var SPINNER_FRAMES = ["\u280B", "\u2819", "\u2839", "\u2838", "\u283C", "\u2834", "\u2826", "\u2827", "\u2807", "\u280F"];
  var spinnerInterval = null;
  var spinnerStart = null;
  function showSpinner(targets, message = "filtering...") {
    if (spinnerInterval) clearInterval(spinnerInterval);
    let frame = 0;
    spinnerStart = Date.now();
    spinnerInterval = setInterval(() => {
      const elapsed = ((Date.now() - spinnerStart) / 1e3).toFixed(1);
      targets.forEach((el) => {
        if (el)
          el.textContent = ` ${SPINNER_FRAMES[frame % SPINNER_FRAMES.length].padEnd(2, " ")} ${message} (${elapsed}s)`;
      });
      frame++;
    }, 120);
  }
  function removeSpinner(targets) {
    if (spinnerInterval) {
      clearInterval(spinnerInterval);
      spinnerInterval = null;
    }
    spinnerStart = null;
    targets.forEach((el) => {
      if (el) el.textContent = "";
    });
  }

  // extension/utils/apiSettings.js
  var DEFAULT_REMOTE_API_ENDPOINT = "https://filtergenie-api.onrender.com";
  var DEFAULT_LOCAL_API_ENDPOINT = "http://localhost:8000";
  var ApiSettings = class {
    static async get() {
      return new Promise((resolve) => {
        chrome.storage.local.get(
          ["popupApiMode", "popupApiKey"],
          ({ popupApiMode, popupApiKey }) => {
            resolve({
              apiMode: popupApiMode,
              apiKey: popupApiKey
            });
          }
        );
      });
    }
    static async save(apiMode, apiKey) {
      return new Promise((resolve) => {
        chrome.storage.local.set(
          { popupApiMode: apiMode, popupApiKey: apiKey },
          resolve
        );
      });
    }
    static async getApiSettings() {
      return this.get();
    }
  };

  // extension/src/content.js
  function getPlatform() {
    var _a;
    const reg = platformRegistry;
    const url = window.location.href;
    if (!reg || !((_a = reg._platforms) == null ? void 0 : _a.length)) return null;
    return reg.getCurrentPlatform(url);
  }
  function getApiEndpoint(apiMode) {
    return apiMode === "remote" ? DEFAULT_REMOTE_API_ENDPOINT : DEFAULT_LOCAL_API_ENDPOINT;
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
    let resp;
    try {
      resp = await fetch(`${apiEndpoint}/items/analyze`, {
        method: "POST",
        headers,
        body: JSON.stringify({ items, filters })
      });
      chrome.runtime.sendMessage({
        type: "API_STATUS",
        status: resp.status,
        error: resp.ok ? void 0 : await resp.text()
      });
    } catch (e) {
      chrome.runtime.sendMessage({
        type: "API_STATUS",
        status: 0,
        error: e && e.message ? e.message : String(e)
      });
      throw e;
    }
    return resp.json();
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
      statusDiv.innerHTML = Object.entries(filterResults).map(([desc, matched]) => `${matched ? "\u2705" : "\u274C"} ${desc}`).join("<br>");
      item.style.display = matchCount >= minMatch ? "" : "none";
    });
  }
  async function analyzeItems(filters, minMatch, platform, maxItems, sendResponse) {
    if (!platform) return;
    const items = Array.from(platform.getItemElements()).slice(0, maxItems);
    if (!items.length) return;
    const statusDivs = items.map((item) => {
      let div = item.querySelector(".filtergenie-status");
      if (!div) {
        div = document.createElement("div");
        div.className = "filtergenie-status";
        item.appendChild(div);
      }
      return div;
    });
    showSpinner(statusDivs);
    const itemSources = await fetchItemSources(platform, items);
    const { apiMode, apiKey } = await ApiSettings.getApiSettings();
    let apiEndpoint = getApiEndpoint(apiMode);
    let data;
    try {
      data = await callApiAnalyze(itemSources, filters, apiEndpoint, apiKey);
    } catch (e) {
      removeSpinner(statusDivs);
      sendResponse == null ? void 0 : sendResponse({ apiResponse: "API error" });
      return;
    }
    removeSpinner(statusDivs);
    if (!data.filters) {
      sendResponse == null ? void 0 : sendResponse({ apiResponse: data });
      return;
    }
    updateItemStatus(items, data.filters, minMatch);
    chrome.storage.local.set({
      filtergenieLastAnalyzed: {
        filtersData: data.filters,
        minMatch,
        maxItems,
        timestamp: Date.now()
      }
    });
    sendResponse == null ? void 0 : sendResponse({ apiResponse: data });
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
  document.addEventListener("DOMContentLoaded", () => {
    chrome.storage.local.set({ popupAppliedFilters: [] });
    chrome.storage.local.get("filtergenieLastAnalyzed", (res) => {
      const last = res.filtergenieLastAnalyzed;
      if (!(last == null ? void 0 : last.filtersData)) return;
      const platform = getPlatform();
      if (!platform) return;
      const maxItems = typeof last.maxItems === "number" ? last.maxItems : 10;
      const items = Array.from(platform.getItemElements()).slice(0, maxItems);
      if (!items.length) return;
      updateItemStatus(items, last.filtersData, last.minMatch);
    });
  });
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "APPLY_FILTERS") {
      const platform = getPlatform();
      analyzeItems(
        msg.activeFilters,
        msg.minMatch,
        platform,
        msg.maxItems,
        sendResponse
      );
      return true;
    }
    if (msg.type === "UPDATE_MIN_MATCH") {
      updateItemVisibility(
        msg.minMatch,
        typeof msg.maxItems === "number" ? msg.maxItems : 10
      );
    }
  });
})();
