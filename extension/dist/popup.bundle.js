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

  // extension/popup/popup.js
  document.addEventListener("DOMContentLoaded", () => {
    const FILTERS_KEY = "popupFilters";
    const MIN_MATCH_KEY = "popupMinMatch";
    const MAX_ITEMS_KEY = "popupMaxItems";
    const API_MODE_KEY = "popupApiMode";
    const API_KEY_KEY = "popupApiKey";
    function clampMinMatch(minMatch, count) {
      return Math.max(0, Math.min(minMatch, count));
    }
    const state = {
      filters: [],
      minMatch: void 0,
      maxItems: void 0,
      apiMode: void 0,
      apiKey: void 0,
      subscribe(fn) {
        (this._listeners || (this._listeners = [])).push(fn);
      },
      notify() {
        (this._listeners || []).forEach((fn) => fn());
      },
      set(key, value) {
        this[key] = value;
        if (key !== "apiMode" && key !== "apiKey") {
          saveState();
        }
        this.notify();
      },
      setFilters(filters) {
        this.set("filters", filters);
      },
      addFilter(filter) {
        if (!this.filters.includes(filter)) {
          this.filters.push(filter);
          saveState();
          this.notify();
        }
      },
      removeFilter(index) {
        this.filters.splice(index, 1);
        saveState();
        this.notify();
      },
      resetFilters() {
        this.set("filters", []);
      },
      setMinMatch(val) {
        this.set("minMatch", clampMinMatch(val, this.filters.length));
      },
      setMaxItems(val) {
        this.set("maxItems", Math.max(1, val));
      },
      setApiMode(mode) {
        this.apiMode = mode;
        chrome.storage.local.set({ [API_MODE_KEY]: mode });
        this.notify();
      },
      setApiKey(key) {
        this.apiKey = key;
        chrome.storage.local.set({ [API_KEY_KEY]: key });
        this.notify();
      }
    };
    const ui = {};
    [
      "filters-form",
      "filter-input",
      "filters-list",
      "add-filter",
      "apply-filters",
      "reset-filters",
      "min-match",
      "min-match-value",
      "max-items",
      "api-mode-remote",
      "api-mode-local",
      "api-key-row",
      "api-key",
      "filtergenie-message",
      "api-health-btn",
      "health-status",
      "api-auth-row",
      "api-auth-btn",
      "auth-status",
      "api-clear-cache-row",
      "api-clear-cache-btn",
      "clear-cache-status",
      "api-spinner",
      "api-elapsed",
      "api-status",
      "api-total-time"
    ].forEach((id) => {
      ui[id.replace(/-([a-z])/g, (g) => g[1].toUpperCase())] = document.getElementById(id);
    });
    function loadDefaultsFromHtml() {
      state.filters = Array.from(ui.filtersList.children).map((li) => {
        var _a;
        return (_a = li.textContent) == null ? void 0 : _a.replace(/✖$/, "").trim();
      }).filter(Boolean);
      state.minMatch = Number(ui.minMatch.value);
      state.maxItems = Number(ui.maxItems.value);
      state.apiMode = ui.apiModeRemote.checked ? "remote" : "local";
      state.apiKey = ui.apiKey.value;
    }
    function saveState() {
      chrome.storage.local.set({
        popupFilters: state.filters,
        popupMinMatch: state.minMatch,
        popupMaxItems: state.maxItems
      });
    }
    function loadState(cb) {
      chrome.storage.local.get(
        [
          "popupFilters",
          "popupMinMatch",
          "popupMaxItems",
          "popupApiMode",
          "popupApiKey"
        ],
        (res) => {
          loadDefaultsFromHtml();
          if (Array.isArray(res.popupFilters)) state.filters = res.popupFilters;
          if (typeof res.popupMinMatch === "number")
            state.minMatch = res.popupMinMatch;
          if (typeof res.popupMaxItems === "number")
            state.maxItems = res.popupMaxItems;
          if (typeof res.popupApiMode === "string")
            state.apiMode = res.popupApiMode;
          if (typeof res.popupApiKey === "string") state.apiKey = res.popupApiKey;
          state.notify();
          if (cb) cb();
        }
      );
    }
    function renderUI() {
      ui.filtersList.innerHTML = "";
      state.filters.forEach((f, i) => {
        const li = document.createElement("li");
        li.textContent = f;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = "\u2716";
        btn.onclick = () => state.removeFilter(i);
        li.appendChild(btn);
        ui.filtersList.appendChild(li);
      });
      Object.assign(ui.minMatch, {
        min: 0,
        max: Math.max(0, state.filters.length),
        value: clampMinMatch(state.minMatch, state.filters.length),
        disabled: !state.filters.length
      });
      ui.minMatchValue.textContent = ui.minMatch.value;
      ui.maxItems.value = state.maxItems;
      const hasFilters = state.filters.length > 0;
      ui.applyFilters.disabled = !hasFilters;
      ui.resetFilters.disabled = !hasFilters;
      ui.addFilter.disabled = !ui.filterInput.value.trim();
      ui.apiModeRemote.checked = state.apiMode === "remote";
      ui.apiModeLocal.checked = state.apiMode === "local";
      ui.apiKeyRow.style.display = state.apiMode === "remote" ? "" : "none";
      ui.apiKey.value = state.apiKey;
      ui.apiAuthRow.style.display = state.apiMode === "remote" ? "" : "none";
      ui.apiAuthBtn.disabled = state.apiMode === "local";
      ui.authStatus.textContent = state.apiMode === "local" ? "Not required for local API" : "";
      ui.apiClearCacheRow.style.display = "";
      if (!["remote", "local"].includes(state.apiMode)) {
        ui.clearCacheStatus.textContent = "";
      }
    }
    function bindFilterEvents(sendToContent2) {
      ui.addFilter.onclick = () => {
        const v = ui.filterInput.value.trim();
        if (v) {
          state.addFilter(v);
          ui.filterInput.value = "";
          ui.addFilter.disabled = true;
        }
      };
      ui.filterInput.oninput = () => {
        ui.addFilter.disabled = !ui.filterInput.value.trim();
      };
      ui.filterInput.onkeydown = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          ui.addFilter.onclick();
        }
      };
      ui.resetFilters.onclick = () => state.resetFilters();
      ui.applyFilters.onclick = () => {
        state.setMaxItems(+ui.maxItems.value);
        ui.applyFilters.disabled = true;
        showSpinner([ui.apiSpinner], "filtering...");
        const requestStart = Date.now();
        sendToContent2({
          type: "APPLY_FILTERS",
          activeFilters: state.filters,
          minMatch: state.minMatch,
          maxItems: state.maxItems
        });
        chrome.runtime.onMessage.addListener(function apiStatusListener(msg) {
          if (msg.type === "API_STATUS") {
            const totalTime = (Date.now() - requestStart) / 1e3;
            removeSpinner([ui.apiSpinner]);
            ui.apiStatus.textContent = `API status: ${msg.status}`;
            ui.apiTotalTime.textContent = `Total request time: ${totalTime.toFixed(1)}s`;
            chrome.runtime.onMessage.removeListener(apiStatusListener);
            ui.applyFilters.disabled = false;
          }
        });
      };
    }
    function bindMatchEvents(sendToContent2) {
      ui.minMatch.oninput = () => {
        state.setMinMatch(+ui.minMatch.value);
        ui.minMatchValue.textContent = ui.minMatch.value;
        sendToContent2({
          type: "UPDATE_MIN_MATCH",
          minMatch: state.minMatch,
          maxItems: state.maxItems
        });
      };
      ui.maxItems.oninput = () => {
        state.setMaxItems(+ui.maxItems.value);
        sendToContent2({
          type: "UPDATE_MIN_MATCH",
          minMatch: state.minMatch,
          maxItems: state.maxItems
        });
      };
    }
    function bindApiEvents() {
      [ui.apiModeRemote, ui.apiModeLocal].forEach((el) => {
        el.onchange = () => {
          state.setApiMode(ui.apiModeRemote.checked ? "remote" : "local");
          ui.healthStatus.textContent = "";
          ui.authStatus.textContent = "";
          ui.clearCacheStatus.textContent = "";
        };
      });
      ui.apiKey.oninput = () => state.setApiKey(ui.apiKey.value.trim());
      ui.apiHealthBtn.onclick = async () => {
        const endpoint = state.apiMode === "remote" ? DEFAULT_REMOTE_API_ENDPOINT : DEFAULT_LOCAL_API_ENDPOINT;
        ui.healthStatus.textContent = "Checking...";
        try {
          const resp = await fetch(endpoint.replace(/\/+$/, "") + "/health");
          ui.healthStatus.textContent = resp.ok ? "\u2705 Healthy" : "\u274C Unhealthy";
        } catch (e) {
          ui.healthStatus.textContent = "\u274C Error contacting API";
        }
      };
      ui.apiAuthBtn.onclick = async () => {
        if (state.apiMode === "local") return;
        const endpoint = DEFAULT_REMOTE_API_ENDPOINT.replace(/\/+$/, "");
        ui.authStatus.textContent = "Checking...";
        try {
          const resp = await fetch(endpoint + "/auth/check", {
            headers: state.apiKey ? { "X-API-Key": state.apiKey } : {}
          });
          if (resp.ok) {
            ui.authStatus.textContent = "\u2705 Authenticated";
          } else {
            ui.authStatus.textContent = "\u274C Invalid API key";
          }
        } catch (e) {
          ui.authStatus.textContent = "\u274C Error contacting API";
        }
      };
      ui.apiClearCacheBtn.onclick = async () => {
        const endpoint = state.apiMode === "remote" ? DEFAULT_REMOTE_API_ENDPOINT.replace(/\/+$/, "") : DEFAULT_LOCAL_API_ENDPOINT.replace(/\/+$/, "");
        ui.clearCacheStatus.textContent = "Clearing...";
        try {
          const resp = await fetch(endpoint + "/cache/clear", {
            method: "POST",
            headers: state.apiKey ? { "X-API-Key": state.apiKey } : {}
          });
          if (resp.ok) {
            const data = await resp.json();
            ui.clearCacheStatus.textContent = data.entries_cleared !== void 0 ? `\u2705 Cleared (${data.entries_cleared} entries)` : "\u2705 Cleared";
          } else {
            ui.clearCacheStatus.textContent = "\u274C Failed to clear cache";
          }
        } catch (e) {
          ui.clearCacheStatus.textContent = "\u274C Error contacting API";
        }
      };
    }
    function bindStorageEvents() {
      chrome.storage.onChanged.addListener((changes) => {
        if (changes.popupFilters || changes.popupMinMatch || changes.popupMaxItems || changes.popupApiMode || changes.popupApiKey) {
          loadState(renderUI);
        }
      });
    }
    function bindUIEvents(sendToContent2) {
      bindFilterEvents(sendToContent2);
      bindMatchEvents(sendToContent2);
      bindApiEvents();
      bindStorageEvents();
    }
    function setupEvents(sendToContent2) {
      bindUIEvents(sendToContent2);
      state.subscribe(renderUI);
    }
    function sendToContent(msg) {
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        (tab == null ? void 0 : tab.id) && chrome.tabs.sendMessage(tab.id, msg);
      });
    }
    loadState(() => {
      renderUI();
      setupEvents(sendToContent);
    });
  });
})();
