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
  function createFilterBadge(text, onRemove) {
    const badge = document.createElement("li");
    badge.className = "inline-flex items-center rounded-full bg-primary-600/30 px-3 py-1 text-sm font-medium text-primary-200 ring-1 ring-inset ring-primary-700/30 mr-2 mb-2 animate-fade-in";
    const span = document.createElement("span");
    span.textContent = text;
    badge.appendChild(span);
    if (onRemove) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ml-1 inline-flex items-center justify-center rounded-full h-5 w-5 transition ease-in-out duration-150 focus:outline-none";
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
      "api-health-btn",
      "health-status",
      "api-auth-btn",
      "auth-status",
      "api-clear-cache-btn",
      "clear-cache-status",
      "api-spinner",
      "api-status",
      "api-total-time",
      "settings-toggle",
      "api-settings",
      "api-progress-section",
      "api-auth-row"
    ].forEach((id) => {
      ui[id.replace(/-([a-z])/g, (g) => g[1].toUpperCase())] = document.getElementById(id);
    });
    function clampMinMatch(minMatch, count) {
      return Math.max(0, Math.min(minMatch, count));
    }
    const pendingRequests = {
      health: false,
      auth: false,
      clearCache: false,
      abortController: null
    };
    function resetPendingRequests() {
      if (pendingRequests.abortController) {
        pendingRequests.abortController.abort();
      }
      pendingRequests.health = false;
      pendingRequests.auth = false;
      pendingRequests.clearCache = false;
      pendingRequests.abortController = new AbortController();
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
        if (JSON.stringify(this.filters) === JSON.stringify(filters)) return;
        this.set("filters", filters);
      },
      addFilter(filter) {
        if (!filter || this.filters.includes(filter)) return false;
        this.filters.push(filter);
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
          resetPendingRequests();
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
    let lastApiDoneTime = null;
    let lastApiStatus = "ready";
    let lastApiError = null;
    function setApiStatus(status, elapsed = null, doneTime = null, error = null) {
      lastApiStatus = status;
      lastApiError = error;
      if (status === "done") lastApiDoneTime = doneTime;
      else if (status !== "done") lastApiDoneTime = null;
      renderApiStatusBadge();
    }
    function renderApiStatusBadge() {
      ui.apiSpinner.innerHTML = "";
      let badge = document.createElement("span");
      badge.className = "badge ";
      if (lastApiStatus === "filtering") {
        badge.className += "bg-blue-500/20 text-blue-300 badge";
        badge.textContent = "Filtering...";
      } else if (lastApiStatus === "done" && lastApiDoneTime != null) {
        badge.className += "bg-green-500/20 text-green-400 badge";
        badge.textContent = `Done (${lastApiDoneTime.toFixed(1)}s)`;
      } else if (lastApiStatus === "error") {
        badge.className += "bg-red-500/20 text-red-400 badge";
        badge.textContent = lastApiError || "API Error";
      } else {
        badge.className += "bg-primary-600/20 text-primary-300 badge";
        badge.textContent = "Ready";
      }
      ui.apiSpinner.appendChild(badge);
    }
    function resetApiBadgeOnInteraction() {
      if (lastApiStatus === "done" || lastApiStatus === "error") {
        setApiStatus("ready");
      }
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
    function saveState() {
      ignoreNextStorageUpdate = true;
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
          renderUI();
          if (cb) cb();
        }
      );
    }
    function renderUI() {
      ui.filtersList.innerHTML = "";
      state.filters.forEach((filter, index) => {
        const badge = createFilterBadge(filter, () => state.removeFilter(index));
        ui.filtersList.appendChild(badge);
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
      ui.applyFilters.disabled = !hasFilters || !state.isConnected;
      ui.resetFilters.disabled = !hasFilters;
      ui.addFilter.disabled = !ui.filterInput.value.trim();
      ui.apiModeRemote.checked = state.apiMode === "remote";
      ui.apiModeLocal.checked = state.apiMode === "local";
      ui.apiKeyRow.style.display = state.apiMode === "remote" ? "" : "none";
      ui.apiAuthRow.style.display = state.apiMode === "remote" ? "" : "none";
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
      state.showNotification(connected);
      ui.apiStatus.innerHTML = "";
      renderApiStatusBadge();
      ui.apiTotalTime.textContent = "";
    }
    function checkConnection() {
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (!(tab == null ? void 0 : tab.id)) {
          state.setConnection(false);
          return;
        }
        state.currentActiveTab = tab;
        chrome.tabs.sendMessage(tab.id, { type: "PING" }, (response) => {
          const isConnected = !chrome.runtime.lastError && (response == null ? void 0 : response.type) === "PONG";
          state.setConnection(isConnected);
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
              setApiStatus("done", null, totalTime);
            } else {
              setApiStatus("error", null, null, msg.error);
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
      ui.settingsToggle.onclick = () => {
        const isHidden = ui.apiSettings.classList.contains("hidden");
        if (isHidden) {
          ui.apiSettings.classList.remove("hidden");
          ui.apiSettings.classList.add("animate-fade-in");
        } else {
          ui.apiSettings.classList.add(
            "opacity-0",
            "transition-opacity",
            "duration-300"
          );
          setTimeout(() => {
            ui.apiSettings.classList.add("hidden");
            ui.apiSettings.classList.remove(
              "opacity-0",
              "transition-opacity",
              "duration-300"
            );
          }, 300);
        }
      };
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
        if (pendingRequests.health) return;
        pendingRequests.health = true;
        resetPendingRequests();
        ui.healthStatus.textContent = "Checking...";
        ui.apiHealthBtn.disabled = true;
        const endpoint = state.apiMode === "remote" ? DEFAULT_REMOTE_API_ENDPOINT : DEFAULT_LOCAL_API_ENDPOINT;
        try {
          const resp = await fetch(endpoint.replace(/\/+$/, "") + "/health", {
            signal: pendingRequests.abortController.signal
          });
          if (resp.ok) {
            ui.healthStatus.innerHTML = '<span class="text-green-400">\u2713 API is healthy</span>';
          } else {
            ui.healthStatus.innerHTML = '<span class="text-red-400">\u2717 API is unhealthy</span>';
          }
        } catch (error) {
          if (error.name !== "AbortError") {
            ui.healthStatus.innerHTML = '<span class="text-red-400">\u2717 Cannot connect to API</span>';
          }
        } finally {
          pendingRequests.health = false;
          ui.apiHealthBtn.disabled = false;
        }
      };
      ui.apiAuthBtn.onclick = async () => {
        if (pendingRequests.auth) return;
        if (state.apiMode === "local") {
          ui.authStatus.innerHTML = '<span class="text-gray-400">Not required for local API</span>';
          return;
        }
        pendingRequests.auth = true;
        resetPendingRequests();
        ui.authStatus.textContent = "Checking...";
        ui.apiAuthBtn.disabled = true;
        const endpoint = DEFAULT_REMOTE_API_ENDPOINT.replace(/\/+$/, "");
        try {
          const resp = await fetch(endpoint + "/auth/check", {
            headers: state.apiKey ? { "X-API-Key": state.apiKey } : {},
            signal: pendingRequests.abortController.signal
          });
          if (resp.ok) {
            ui.authStatus.innerHTML = '<span class="text-green-400">\u2713 Authenticated</span>';
          } else {
            ui.authStatus.innerHTML = '<span class="text-red-400">\u2717 Authentication failed</span>';
          }
        } catch (error) {
          if (error.name !== "AbortError") {
            ui.authStatus.innerHTML = '<span class="text-red-400">\u2717 Cannot connect to API</span>';
          }
        } finally {
          pendingRequests.auth = false;
          ui.apiAuthBtn.disabled = false;
        }
      };
      ui.apiClearCacheBtn.onclick = async () => {
        if (pendingRequests.clearCache) return;
        pendingRequests.clearCache = true;
        resetPendingRequests();
        ui.clearCacheStatus.textContent = "Clearing...";
        ui.apiClearCacheBtn.disabled = true;
        const endpoint = state.apiMode === "remote" ? DEFAULT_REMOTE_API_ENDPOINT.replace(/\/+$/, "") : DEFAULT_LOCAL_API_ENDPOINT.replace(/\/+$/, "");
        try {
          const resp = await fetch(endpoint + "/cache/clear", {
            method: "POST",
            headers: state.apiKey ? { "X-API-Key": state.apiKey } : {},
            signal: pendingRequests.abortController.signal
          });
          if (resp.ok) {
            const data = await resp.json();
            ui.clearCacheStatus.innerHTML = `<span class="text-green-400">\u2713 Cleared ${data.entries_cleared !== void 0 ? `(${data.entries_cleared} entries)` : ""}</span>`;
          } else {
            ui.clearCacheStatus.innerHTML = '<span class="text-red-400">\u2717 Failed to clear cache</span>';
          }
        } catch (error) {
          if (error.name !== "AbortError") {
            ui.clearCacheStatus.innerHTML = '<span class="text-red-400">\u2717 Error contacting API</span>';
          }
        } finally {
          pendingRequests.clearCache = false;
          ui.apiClearCacheBtn.disabled = false;
        }
      };
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
        if (changes.popupFilters || changes.popupMinMatch || changes.popupMaxItems || changes.popupApiMode || changes.popupApiKey) {
          loadState();
        }
      });
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
    }
    loadState(() => {
      setupEvents(sendToContent);
    });
  });
})();
