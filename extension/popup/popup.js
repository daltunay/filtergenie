import "../platforms/leboncoin.js";
import "../platforms/vinted.js";
import {
  createSpinner,
  createFilterBadge,
  createTooltip,
} from "./components/ui-components.js";
import {
  showSpinner,
  removeSpinner,
  updateSpinnerMessage,
} from "../utils/spinnerUtils.js";
import {
  DEFAULT_REMOTE_API_ENDPOINT,
  DEFAULT_LOCAL_API_ENDPOINT,
  ApiSettings,
} from "../utils/apiSettings.js";

document.addEventListener("DOMContentLoaded", () => {
  const FILTERS_KEY = "popupFilters";
  const MIN_MATCH_KEY = "popupMinMatch";
  const MAX_ITEMS_KEY = "popupMaxItems";
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
    "api-elapsed",
    "api-status",
    "api-total-time",
    "settings-toggle",
    "api-settings",
    "api-progress-section",
    "api-auth-row",
  ].forEach((id) => {
    ui[id.replace(/-([a-z])/g, (g) => g[1].toUpperCase())] =
      document.getElementById(id);
  });

  function clampMinMatch(minMatch, count) {
    return Math.max(0, Math.min(minMatch, count));
  }

  const pendingRequests = {
    health: false,
    auth: false,
    clearCache: false,
    abortController: null,
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
    notificationShown: false,
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
      if (
        key !== "apiMode" &&
        key !== "apiKey" &&
        key !== "isConnected" &&
        key !== "currentActiveTab" &&
        key !== "notificationShown" &&
        key !== "renderInProgress"
      ) {
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
      if (!isConnected && !this.notificationShown) {
        const notification = document.createElement("div");
        notification.className =
          "bg-amber-500/20 text-amber-300 rounded-md px-4 py-3 text-sm animate-fade-in";
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
        ui.notificationArea.innerHTML = "";
        ui.notificationArea.appendChild(notification);
        this.notificationShown = true;
      } else if (isConnected) {
        ui.notificationArea.innerHTML = "";
        this.notificationShown = false;
      }
    },
  };

  function setApiStatusBadge(status, message, statusCode) {
    let color,
      icon,
      label = "";
    if (status === "ready") {
      color = "bg-green-500/20 text-green-400";
      icon = `<svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`;
      label = "Ready";
      if (statusCode !== undefined) label += ` (${statusCode})`;
    } else if (status === "error") {
      color = "bg-red-500/20 text-red-400";
      icon = `<svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>`;
      label = message || "Error";
      if (statusCode !== undefined) label += ` (${statusCode})`;
    } else if (status === "loading") {
      color = "bg-primary-600/20 text-primary-400";
      icon = `<svg class="h-4 w-4 mr-1 animate-spin" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10"/><path class="opacity-75" d="M4 12a8 8 0 018-8"/></svg>`;
      label = message || "Loading...";
    } else {
      color = "";
      icon = "";
      label = "";
    }
    if (ui.apiStatus) {
      ui.apiStatus.innerHTML = label
        ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}">${icon}${label}</span>`
        : "";
    }
  }

  function loadDefaultsFromHtml() {
    state.filters = Array.from(ui.filtersList.children)
      .map((li) => li.textContent?.replace(/✖$/, "").trim())
      .filter(Boolean);
    state.minMatch = Number(ui.minMatch.value);
    state.maxItems = Number(ui.maxItems.value);
    state.apiMode = ui.apiModeRemote.checked ? "remote" : "local";
    state.apiKey = ui.apiKey.value;
  }

  function saveState() {
    ignoreNextStorageUpdate = true;
    chrome.storage.local.set({
      popupFilters: state.filters,
      popupMinMatch: state.minMatch,
      popupMaxItems: state.maxItems,
    });
  }

  function loadState(cb) {
    chrome.storage.local.get(
      [
        "popupFilters",
        "popupMinMatch",
        "popupMaxItems",
        "popupApiMode",
        "popupApiKey",
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
      },
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
      disabled: !state.filters.length,
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

    const statusIndicator =
      ui.connectionStatus.querySelector("span:first-child");
    let statusText = ui.connectionStatus.querySelector("span:last-child");
    if (!statusText) {
      statusText = document.createElement("span");
      ui.connectionStatus.appendChild(statusText);
    }

    if (state.isConnected) {
      statusIndicator.className =
        "inline-flex h-4 w-4 rounded-full mr-2 bg-green-500";
      statusText.textContent = "Available";
      statusText.className = "text-green-400";
      state.showNotification(true);
    } else {
      statusIndicator.className =
        "inline-flex h-4 w-4 rounded-full mr-2 bg-red-500";
      statusText.textContent = "Not available";
      statusText.className = "text-red-400";
      state.showNotification(false);
    }

    setApiStatusBadge();

    ui.apiTotalTime.textContent = "";
  }

  function checkConnection() {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab?.id) {
        state.setConnection(false);
        return;
      }

      state.currentActiveTab = tab;

      chrome.tabs.sendMessage(tab.id, { type: "PING" }, (response) => {
        const isConnected =
          !chrome.runtime.lastError && response?.type === "PONG";
        state.setConnection(isConnected);
      });
    });
  }

  function bindFilterEvents(sendToContent) {
    ui.addFilter.onclick = () => {
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
      ui.addFilter.disabled = !ui.filterInput.value.trim();
    };

    ui.filterInput.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        ui.addFilter.onclick();
      }
    };

    ui.resetFilters.onclick = () => {
      state.resetFilters();
      // Also clear last analyzed data so filters do not reappear on reload
      chrome.storage.local.remove("filtergenieLastAnalyzed");
      sendToContent({ type: "RESET_FILTERS_ON_PAGE" });
    };

    ui.applyFilters.onclick = () => {
      state.setMaxItems(+ui.maxItems.value);
      ui.applyFilters.disabled = true;

      const spinner = createSpinner("sm");
      ui.apiSpinner.innerHTML = "";
      ui.apiSpinner.appendChild(spinner);

      setApiStatusBadge("loading", "Filtering...");

      const requestStart = Date.now();

      ui.apiElapsed.textContent = "";

      sendToContent({
        type: "APPLY_FILTERS",
        activeFilters: state.filters,
        minMatch: state.minMatch,
        maxItems: state.maxItems,
      });

      chrome.runtime.onMessage.addListener(function apiStatusListener(msg) {
        if (msg.type === "API_STATUS") {
          const totalTime = (Date.now() - requestStart) / 1000;
          ui.apiSpinner.innerHTML = "";

          if (msg.status === 200) {
            setApiStatusBadge("ready", undefined, msg.status);
          } else {
            setApiStatusBadge("error", msg.error || "API Error", msg.status);
          }

          ui.apiElapsed.textContent = `Time: ${totalTime.toFixed(1)}s`;

          chrome.runtime.onMessage.removeListener(apiStatusListener);
          ui.applyFilters.disabled = false;
        }
      });
    };
  }

  function bindMatchEvents(sendToContent) {
    const debounce = (fn, delay) => {
      let timeout;
      return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
      };
    };

    const debouncedMinMatchHandler = debounce((value) => {
      state.setMinMatch(+value);
      ui.minMatchValue.textContent = state.minMatch;
      sendToContent({
        type: "UPDATE_MIN_MATCH",
        minMatch: state.minMatch,
        maxItems: state.maxItems,
      });
    }, 300);

    const debouncedMaxItemsHandler = debounce((value) => {
      state.setMaxItems(+value);
      sendToContent({
        type: "UPDATE_MIN_MATCH",
        minMatch: state.minMatch,
        maxItems: state.maxItems,
      });
    }, 300);

    ui.minMatch.oninput = (e) => {
      ui.minMatchValue.textContent = e.target.value;
      debouncedMinMatchHandler(e.target.value);
    };

    ui.maxItems.oninput = (e) => {
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
          "duration-300",
        );
        setTimeout(() => {
          ui.apiSettings.classList.add("hidden");
          ui.apiSettings.classList.remove(
            "opacity-0",
            "transition-opacity",
            "duration-300",
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

      const endpoint =
        state.apiMode === "remote"
          ? DEFAULT_REMOTE_API_ENDPOINT
          : DEFAULT_LOCAL_API_ENDPOINT;

      try {
        const resp = await fetch(endpoint.replace(/\/+$/, "") + "/health", {
          signal: pendingRequests.abortController.signal,
        });

        if (resp.ok) {
          ui.healthStatus.innerHTML =
            '<span class="text-green-400">✓ API is healthy</span>';
        } else {
          ui.healthStatus.innerHTML =
            '<span class="text-red-400">✗ API is unhealthy</span>';
        }
      } catch (error) {
        if (error.name !== "AbortError") {
          ui.healthStatus.innerHTML =
            '<span class="text-red-400">✗ Cannot connect to API</span>';
        }
      } finally {
        pendingRequests.health = false;
        ui.apiHealthBtn.disabled = false;
      }
    };

    ui.apiAuthBtn.onclick = async () => {
      if (pendingRequests.auth) return;

      if (state.apiMode === "local") {
        ui.authStatus.innerHTML =
          '<span class="text-gray-400">Not required for local API</span>';
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
          signal: pendingRequests.abortController.signal,
        });

        if (resp.ok) {
          ui.authStatus.innerHTML =
            '<span class="text-green-400">✓ Authenticated</span>';
        } else {
          ui.authStatus.innerHTML =
            '<span class="text-red-400">✗ Authentication failed</span>';
        }
      } catch (error) {
        if (error.name !== "AbortError") {
          ui.authStatus.innerHTML =
            '<span class="text-red-400">✗ Cannot connect to API</span>';
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

      const endpoint =
        state.apiMode === "remote"
          ? DEFAULT_REMOTE_API_ENDPOINT.replace(/\/+$/, "")
          : DEFAULT_LOCAL_API_ENDPOINT.replace(/\/+$/, "");

      try {
        const resp = await fetch(endpoint + "/cache/clear", {
          method: "POST",
          headers: state.apiKey ? { "X-API-Key": state.apiKey } : {},
          signal: pendingRequests.abortController.signal,
        });

        if (resp.ok) {
          const data = await resp.json();
          ui.clearCacheStatus.innerHTML = `<span class="text-green-400">✓ Cleared ${
            data.entries_cleared !== undefined
              ? `(${data.entries_cleared} entries)`
              : ""
          }</span>`;
        } else {
          ui.clearCacheStatus.innerHTML =
            '<span class="text-red-400">✗ Failed to clear cache</span>';
        }
      } catch (error) {
        if (error.name !== "AbortError") {
          ui.clearCacheStatus.innerHTML =
            '<span class="text-red-400">✗ Error contacting API</span>';
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
      ui.apiKeyToggle.innerHTML = visible
        ? `<svg id="api-key-eye" class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.956 9.956 0 012.042-3.338m1.528-1.712A9.956 9.956 0 0112 5c4.477 0 8.268 2.943 9.542 7a9.956 9.956 0 01-4.293 5.411M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3l18 18" />
          </svg>`
        : `<svg id="api-key-eye" class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

      if (
        changes.popupFilters ||
        changes.popupMinMatch ||
        changes.popupMaxItems ||
        changes.popupApiMode ||
        changes.popupApiKey
      ) {
        loadState();
      }
    });
  }

  function setupEvents(sendToContent) {
    bindFilterEvents(sendToContent);
    bindMatchEvents(sendToContent);
    bindApiEvents();
    bindApiKeyToggle();
    bindStorageEvents();

    state.subscribe(renderUI);

    checkConnection();
    setInterval(checkConnection, 10000);
  }

  function sendToContent(msg) {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      tab?.id && chrome.tabs.sendMessage(tab.id, msg);
    });
  }

  function addTooltips() {
    createTooltip(ui.addFilter, "Add a new filter", "top");
    createTooltip(ui.applyFilters, "Apply filters to current page", "top");
    createTooltip(ui.resetFilters, "Clear all filters", "top");
    createTooltip(ui.apiHealthBtn, "Check API health", "top");
    createTooltip(ui.apiClearCacheBtn, "Clear API cache", "top");
    const lens = document.getElementById("options-lens");
    if (lens) {
      createTooltip(
        lens,
        "Adjust how many items to analyze and the minimum number of filters that must match for an item to be shown.",
        "top",
      );
    }
  }

  loadState(() => {
    setupEvents(sendToContent);
    addTooltips();
  });
});
