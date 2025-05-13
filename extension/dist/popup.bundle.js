(() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));

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
  function createFilterBadge(text, onRemove) {
    const badge = document.createElement("li");
    badge.className = "inline-flex items-center rounded-full bg-yellow-400/20 px-3 py-1 text-sm font-medium text-yellow-200 ring-1 ring-inset ring-yellow-300/30 mr-2 mb-2 animate-fade-in";
    const span = document.createElement("span");
    span.textContent = text;
    badge.appendChild(span);
    if (onRemove) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ml-1 inline-flex items-center justify-center rounded-full h-5 w-5 transition ease-in-out duration-150 focus:outline-none filtergenie-badge-remove";
      button.innerHTML = `<svg class="h-3 w-3" stroke="currentColor" fill="none" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
    </svg>`;
      button.addEventListener("click", onRemove);
      badge.appendChild(button);
    }
    return badge;
  }

  // extension/utils/apiSettings.js
  var DEFAULT_REMOTE_API_ENDPOINT = "https://filtergenie-api.onrender.com";
  var DEFAULT_LOCAL_API_ENDPOINT = "http://localhost:8000";

  // extension/popup/popup.js
  function debounce(fn, delay) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), delay);
    };
  }
  function sendToContent(msg) {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      (tab == null ? void 0 : tab.id) && chrome.tabs.sendMessage(tab.id, msg);
    });
  }
  document.addEventListener("DOMContentLoaded", () => {
    const API_MODE_KEY = "popupApiMode";
    const API_KEY_KEY = "popupApiKey";
    let ignoreNextStorageUpdate = false;
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
      "api-key-toggle",
      "connection-status",
      "notification-area",
      "api-check-btn",
      "api-spinner",
      "api-status",
      "api-total-time",
      "settings-toggle",
      "api-settings",
      "api-progress-section",
      "api-clear-cache-btn",
      "api-clear-cache-status"
    ].forEach((id) => {
      ui[id.replace(/-([a-z])/g, (g) => g[1].toUpperCase())] = document.getElementById(id);
    });
    function clampMinMatch(minMatch, count) {
      return Math.max(0, Math.min(minMatch, count));
    }
    let apiStatus = {
      state: "unknown",
      message: "Ready",
      elapsed: null,
      doneTime: null,
      error: null,
      startedAt: null
    };
    let elapsedInterval = null;
    function setApiStatus(state2, opts = {}) {
      if (["checking", "filtering"].includes(state2)) {
        apiStatus = __spreadProps(__spreadValues(__spreadProps(__spreadValues({}, apiStatus), {
          state: state2
        }), opts), {
          startedAt: Date.now(),
          elapsed: 0
        });
        startElapsedTimer();
      } else if ([
        "done",
        "available",
        "unavailable",
        "auth-failed",
        "error",
        "ready"
      ].includes(state2)) {
        if (apiStatus.startedAt) {
          const elapsed = (Date.now() - apiStatus.startedAt) / 1e3;
          apiStatus = __spreadProps(__spreadValues(__spreadProps(__spreadValues({}, apiStatus), { state: state2 }), opts), { elapsed, startedAt: null });
        } else {
          apiStatus = __spreadProps(__spreadValues(__spreadProps(__spreadValues({}, apiStatus), { state: state2 }), opts), { startedAt: null });
        }
        stopElapsedTimer();
      } else {
        apiStatus = __spreadValues(__spreadProps(__spreadValues({}, apiStatus), { state: state2 }), opts);
        stopElapsedTimer();
      }
      chrome.storage.local.set({ filtergenieApiStatus: apiStatus });
      renderApiStatusBadge();
    }
    function startElapsedTimer() {
      stopElapsedTimer();
      elapsedInterval = setInterval(() => {
        if (apiStatus.startedAt) {
          apiStatus.elapsed = (Date.now() - apiStatus.startedAt) / 1e3;
          renderApiStatusBadge();
        }
      }, 100);
    }
    function stopElapsedTimer() {
      if (elapsedInterval) {
        clearInterval(elapsedInterval);
        elapsedInterval = null;
      }
    }
    function renderApiStatusBadge() {
      const badge = ui.apiStatus;
      let status = apiStatus.state;
      let text = "";
      let elapsedText = "";
      if (["filtering", "checking"].includes(status) && typeof apiStatus.elapsed === "number") {
        elapsedText = ` (${apiStatus.elapsed.toFixed(1)}s)`;
      } else if (["done", "available"].includes(status) && typeof apiStatus.elapsed === "number") {
        elapsedText = ` (${apiStatus.elapsed.toFixed(1)}s)`;
      }
      switch (status) {
        case "checking":
          text = "Checking...";
          break;
        case "available":
          text = "Available";
          break;
        case "unavailable":
          text = "Unavailable";
          break;
        case "auth-failed":
          text = "Auth failed";
          break;
        case "filtering":
          text = "Filtering...";
          break;
        case "done":
          text = "Done";
          break;
        case "error":
          text = apiStatus.error || "API Error";
          break;
        default:
          text = "Ready";
          status = "ready";
      }
      badge.className = `status-badge status-${status}`;
      badge.textContent = text + elapsedText;
      if (ui.apiCheckBtn) {
        const svg = ui.apiCheckBtn.querySelector("svg");
        if (status === "checking" && svg) {
          svg.classList.add("animate-spin-slow");
          ui.apiCheckBtn.disabled = true;
        } else if (svg) {
          svg.classList.remove("animate-spin-slow");
          ui.apiCheckBtn.disabled = false;
        }
      }
    }
    function restoreApiStatus() {
      chrome.storage.local.get("filtergenieApiStatus", (res) => {
        if (res.filtergenieApiStatus) {
          apiStatus = res.filtergenieApiStatus;
          if (["filtering", "checking"].includes(apiStatus.state) && apiStatus.startedAt) {
            startElapsedTimer();
          }
          renderApiStatusBadge();
        }
      });
    }
    async function checkApiStatus() {
      setApiStatus("checking");
      const endpoint = state.apiMode === "local" ? DEFAULT_LOCAL_API_ENDPOINT : DEFAULT_REMOTE_API_ENDPOINT;
      try {
        const healthResp = await fetch(endpoint.replace(/\/+$/, "") + "/health");
        if (!healthResp.ok) {
          setApiStatus("unavailable");
          return;
        }
        if (state.apiMode === "remote") {
          const authResp = await fetch(
            endpoint.replace(/\/+$/, "") + "/auth/check",
            {
              headers: state.apiKey ? { "X-API-Key": state.apiKey } : {}
            }
          );
          if (!authResp.ok) {
            setApiStatus("auth-failed");
            return;
          }
        }
        setApiStatus("available");
      } catch (e) {
        setApiStatus("unavailable");
      }
    }
    function resetApiBadgeOnInteraction() {
      if (["done", "error", "available", "unavailable", "auth-failed"].includes(
        apiStatus.state
      )) {
        setApiStatus("ready");
      }
    }
    const state = {
      filters: [],
      minMatch: 0,
      maxItems: 10,
      apiMode: "remote",
      apiKey: "",
      isConnected: false,
      currentActiveTab: null,
      renderInProgress: false,
      _listeners: [],
      subscribe(fn) {
        this._listeners.push(fn);
        return () => {
          this._listeners = this._listeners.filter((listener) => listener !== fn);
        };
      },
      notify() {
        if (this.renderInProgress) return;
        this.renderInProgress = true;
        try {
          this._listeners.forEach((fn) => fn());
        } finally {
          this.renderInProgress = false;
        }
      },
      set(key, value) {
        if (this[key] === value) return;
        this[key] = value;
        if (["filters", "minMatch", "maxItems"].includes(key)) {
          saveState();
        }
        this.notify();
      },
      setFilters(filters) {
        const sorted = [...filters].sort((a, b) => a.localeCompare(b));
        if (JSON.stringify(this.filters) === JSON.stringify(sorted)) return;
        this.set("filters", sorted);
      },
      addFilter(filter) {
        if (!filter || this.filters.includes(filter)) return false;
        this.filters.push(filter);
        this.filters.sort((a, b) => a.localeCompare(b));
        saveState();
        this.notify();
        return true;
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
        if (this.apiMode !== mode) {
          this.apiMode = mode;
          ignoreNextStorageUpdate = true;
          chrome.storage.local.set({ [API_MODE_KEY]: mode });
          this.notify();
        }
      },
      setApiKey(key) {
        this.apiKey = key;
        ignoreNextStorageUpdate = true;
        chrome.storage.local.set({ [API_KEY_KEY]: key });
        this.notify();
      },
      setConnection(isConnected) {
        this.isConnected = isConnected;
        this.notify();
      },
      showNotification(isConnected) {
        ui.notificationArea.innerHTML = "";
        if (!isConnected) {
          const notification = document.createElement("div");
          notification.className = "bg-amber-500/20 text-amber-300 rounded-md px-4 py-3 text-sm animate-fade-in";
          notification.innerHTML = `
          <div class="flex items-start">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-amber-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="ml-3">
              <p class="text-sm">
                FilterGenie can only run on <a href="https://github.com/daltunay/filtergenie?tab=readme-ov-file#supported-websites" target="_blank" rel="noopener noreferrer" class="underline text-amber-200 hover:text-amber-100">supported websites</a>.<br>
              </p>
            </div>
          </div>
        `;
          ui.notificationArea.appendChild(notification);
        }
      }
    };
    let lastConnectionStatus = null;
    let lastRenderedFilters = null;
    function renderUI() {
      if (!lastRenderedFilters || JSON.stringify(state.filters) !== JSON.stringify(lastRenderedFilters)) {
        ui.filtersList.innerHTML = "";
        state.filters.forEach((filter, index) => {
          const badge = createFilterBadge(
            filter,
            () => state.removeFilter(index)
          );
          ui.filtersList.appendChild(badge);
        });
        lastRenderedFilters = [...state.filters];
      }
      Object.assign(ui.minMatch, {
        min: 0,
        max: Math.max(0, state.filters.length),
        value: clampMinMatch(state.minMatch, state.filters.length),
        disabled: !state.filters.length
      });
      ui.minMatchValue.textContent = ui.minMatch.value;
      ui.maxItems.value = state.maxItems;
      const hasFilters = state.filters.length > 0;
      ui.applyFilters.disabled = !hasFilters || !state.isConnected;
      ui.resetFilters.disabled = !hasFilters;
      ui.addFilter.disabled = !ui.filterInput.value.trim();
      ui.apiModeRemote.checked = state.apiMode === "remote";
      ui.apiModeLocal.checked = state.apiMode === "local";
      ui.apiKeyRow.style.display = state.apiMode === "remote" ? "" : "none";
      ui.apiKey.value = state.apiKey;
      const statusIndicator = ui.connectionStatus.querySelector("span:first-child");
      let statusText = ui.connectionStatus.querySelector("span:last-child");
      if (!statusText) {
        statusText = document.createElement("span");
        ui.connectionStatus.appendChild(statusText);
      }
      const connected = state.isConnected;
      statusIndicator.className = "inline-flex h-4 w-4 rounded-full mr-2 " + (connected ? "bg-green-500" : "bg-red-500");
      statusText.textContent = connected ? "Available" : "Not available";
      statusText.className = connected ? "text-green-400" : "text-red-400";
      if (lastConnectionStatus !== connected) {
        state.showNotification(connected);
        lastConnectionStatus = connected;
      }
      ui.apiStatus.innerHTML = "";
      renderApiStatusBadge();
      ui.apiTotalTime.textContent = "";
    }
    function checkConnection() {
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (!(tab == null ? void 0 : tab.id)) {
          if (state.isConnected !== false) state.setConnection(false);
          return;
        }
        state.currentActiveTab = tab;
        chrome.tabs.sendMessage(tab.id, { type: "PING" }, (response) => {
          const isConnected = !chrome.runtime.lastError && (response == null ? void 0 : response.type) === "PONG";
          if (state.isConnected !== isConnected) {
            state.setConnection(isConnected);
          }
        });
      });
    }
    function bindFilterEvents(sendToContent2) {
      ui.addFilter.onclick = () => {
        resetApiBadgeOnInteraction();
        const value = ui.filterInput.value.trim();
        if (value && state.addFilter(value)) {
          ui.filterInput.value = "";
          ui.addFilter.disabled = true;
          const badge = ui.filtersList.lastElementChild;
          if (badge) {
            badge.classList.add("animate-fade-in");
            setTimeout(() => badge.classList.remove("animate-fade-in"), 500);
          }
        }
      };
      ui.filterInput.oninput = () => {
        resetApiBadgeOnInteraction();
        ui.addFilter.disabled = !ui.filterInput.value.trim();
      };
      ui.filterInput.onkeydown = (e) => {
        if (e.key === "Enter") {
          resetApiBadgeOnInteraction();
          e.preventDefault();
          ui.addFilter.onclick();
        }
      };
      ui.resetFilters.onclick = () => {
        resetApiBadgeOnInteraction();
        state.resetFilters();
        chrome.storage.local.remove("filtergenieLastAnalyzed");
        sendToContent2({ type: "RESET_FILTERS_ON_PAGE" });
      };
      ui.applyFilters.onclick = () => {
        resetApiBadgeOnInteraction();
        state.setMaxItems(+ui.maxItems.value);
        ui.applyFilters.disabled = true;
        setApiStatus("filtering");
        const requestStart = Date.now();
        const apiEndpoint = state.apiMode === "local" ? DEFAULT_LOCAL_API_ENDPOINT : DEFAULT_REMOTE_API_ENDPOINT;
        const apiKey = state.apiKey;
        sendToContent2({
          type: "APPLY_FILTERS",
          activeFilters: state.filters,
          minMatch: state.minMatch,
          maxItems: state.maxItems,
          apiEndpoint,
          apiKey
        });
        function apiListener(msg) {
          if (msg.type === "FILTERS_APPLIED") {
            if (msg.success) {
              const totalTime = (Date.now() - requestStart) / 1e3;
              setApiStatus("done", { doneTime: totalTime });
            } else {
              setApiStatus("error", { error: msg.error });
            }
            ui.applyFilters.disabled = false;
            chrome.runtime.onMessage.removeListener(apiListener);
          }
        }
        chrome.runtime.onMessage.addListener(apiListener);
      };
    }
    function bindMatchEvents(sendToContent2) {
      const debouncedMinMatchHandler = debounce((value) => {
        state.setMinMatch(+value);
        ui.minMatchValue.textContent = state.minMatch;
        sendToContent2({
          type: "UPDATE_MIN_MATCH",
          minMatch: state.minMatch,
          maxItems: state.maxItems
        });
      }, 300);
      const debouncedMaxItemsHandler = debounce((value) => {
        state.setMaxItems(+value);
        sendToContent2({
          type: "UPDATE_MIN_MATCH",
          minMatch: state.minMatch,
          maxItems: state.maxItems
        });
      }, 300);
      ui.minMatch.oninput = (e) => {
        resetApiBadgeOnInteraction();
        ui.minMatchValue.textContent = e.target.value;
        debouncedMinMatchHandler(e.target.value);
      };
      ui.maxItems.oninput = (e) => {
        resetApiBadgeOnInteraction();
        debouncedMaxItemsHandler(e.target.value);
      };
    }
    function bindApiEvents() {
      if (ui.settingsToggle) {
        ui.settingsToggle.onclick = () => {
          const settings = ui.apiSettings;
          const expanded = settings.classList.contains("expanded");
          if (!expanded) {
            settings.classList.add("expanded");
            settings.classList.remove("hidden");
          } else {
            settings.classList.remove("expanded");
            setTimeout(() => settings.classList.add("hidden"), 300);
          }
        };
      }
      [ui.apiModeRemote, ui.apiModeLocal].forEach((el) => {
        el.onchange = () => {
          state.setApiMode(ui.apiModeRemote.checked ? "remote" : "local");
          setApiStatus("ready");
        };
      });
      ui.apiKey.oninput = () => state.setApiKey(ui.apiKey.value.trim());
      ui.apiCheckBtn.onclick = checkApiStatus;
      if (ui.apiClearCacheBtn) {
        ui.apiClearCacheBtn.onclick = async () => {
          ui.apiClearCacheBtn.disabled = true;
          ui.apiClearCacheStatus.textContent = "Clearing...";
          ui.apiClearCacheStatus.className = "text-xs text-primary-300";
          const endpoint = state.apiMode === "remote" ? DEFAULT_REMOTE_API_ENDPOINT : DEFAULT_LOCAL_API_ENDPOINT;
          try {
            const resp = await fetch(
              endpoint.replace(/\/+$/, "") + "/cache/clear",
              {
                method: "POST",
                headers: state.apiKey && state.apiMode === "remote" ? { "X-API-Key": state.apiKey } : {}
              }
            );
            if (resp.ok) {
              const data = await resp.json().catch(() => ({}));
              if (typeof data.entries_cleared === "number") {
                ui.apiClearCacheStatus.textContent = `Cleared (${data.entries_cleared} entries)`;
              } else {
                ui.apiClearCacheStatus.textContent = "Cleared";
              }
              ui.apiClearCacheStatus.className = "text-xs text-green-400";
            } else {
              ui.apiClearCacheStatus.textContent = "Failed";
              ui.apiClearCacheStatus.className = "text-xs text-red-400";
            }
          } catch (e) {
            ui.apiClearCacheStatus.textContent = "Error";
            ui.apiClearCacheStatus.className = "text-xs text-red-400";
          } finally {
            ui.apiClearCacheBtn.disabled = false;
          }
        };
      }
    }
    function bindApiKeyToggle() {
      if (!ui.apiKeyToggle || !ui.apiKey) return;
      let visible = false;
      ui.apiKeyToggle.onclick = () => {
        visible = !visible;
        ui.apiKey.type = visible ? "text" : "password";
        ui.apiKeyToggle.innerHTML = visible ? `<svg id="api-key-eye" class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.956 9.956 0 012.042-3.338m1.528-1.712A9.956 9.956 0 0112 5c4.477 0 8.268 2.943 9.542 7a9.956 9.956 0 01-4.293 5.411M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3l18 18" />
          </svg>` : `<svg id="api-key-eye" class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>`;
      };
    }
    function bindStorageEvents() {
      chrome.storage.onChanged.addListener((changes) => {
        if (ignoreNextStorageUpdate) {
          ignoreNextStorageUpdate = false;
          return;
        }
        if (changes.popupFilters || changes.popupMinMatch || changes.popupMaxItems || changes.popupApiMode || changes.popupApiKey || changes.filtergenieApiStatus) {
          loadState();
        }
      });
    }
    function saveState() {
      ignoreNextStorageUpdate = true;
      chrome.storage.local.set({
        popupFilters: state.filters,
        popupMinMatch: state.minMatch,
        popupMaxItems: state.maxItems
      });
    }
    function loadDefaultsFromHtml() {
      if (!state.filters.length) {
        state.filters = Array.from(ui.filtersList.children).map((li) => {
          var _a;
          return (_a = li.textContent) == null ? void 0 : _a.replace(/✖$/, "").trim();
        }).filter(Boolean);
      }
      if (!state.minMatch) state.minMatch = Number(ui.minMatch.value);
      if (!state.maxItems) state.maxItems = Number(ui.maxItems.value);
      if (!state.apiMode)
        state.apiMode = ui.apiModeRemote.checked ? "remote" : "local";
      if (!state.apiKey) state.apiKey = ui.apiKey.value;
    }
    function loadState(cb) {
      chrome.storage.local.get(
        [
          "popupFilters",
          "popupMinMatch",
          "popupMaxItems",
          "popupApiMode",
          "popupApiKey",
          "filtergenieApiStatus"
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
          if (res.filtergenieApiStatus) apiStatus = res.filtergenieApiStatus;
          renderUI();
          if (cb) cb();
        }
      );
    }
    function setupEvents(sendToContent2) {
      bindFilterEvents(sendToContent2);
      bindMatchEvents(sendToContent2);
      bindApiEvents();
      bindApiKeyToggle();
      bindStorageEvents();
      state.subscribe(renderUI);
      checkConnection();
      setInterval(checkConnection, 1e4);
      restoreApiStatus();
    }
    loadState(() => {
      setupEvents(sendToContent);
    });
  });
})();
