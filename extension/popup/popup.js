function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

function sendToContent(msg) {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    tab?.id && chrome.tabs.sendMessage(tab.id, msg);
  });
}

import "../platforms/leboncoin.js";
import "../platforms/vinted.js";
import { createFilterBadge } from "./components/ui-components.js";
import {
  DEFAULT_REMOTE_API_ENDPOINT,
  DEFAULT_LOCAL_API_ENDPOINT,
} from "../utils/apiSettings.js";

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
    "max-images",
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
    "api-clear-cache-status",
  ].forEach((id) => {
    ui[id.replace(/-([a-z])/g, (g) => g[1].toUpperCase())] =
      document.getElementById(id);
  });
  ui.filtersSection = document.querySelector("section.card.p-4");

  let apiStatus = {
    state: "unknown",
    message: "",
    elapsed: null,
    startedAt: null,
  };
  let elapsedInterval = null;

  function setApiStatus(state, opts = {}) {
    if (state === "ready" && !stateIsAvailable()) {
      state = "unavailable";
    }
    if (["checking", "filtering"].includes(state)) {
      apiStatus = {
        ...apiStatus,
        state,
        ...opts,
        startedAt: Date.now(),
        elapsed: 0,
      };
      startElapsedTimer();
    } else {
      if (apiStatus.startedAt) {
        apiStatus = {
          ...apiStatus,
          state,
          ...opts,
          elapsed: (Date.now() - apiStatus.startedAt) / 1000,
          startedAt: null,
        };
      } else {
        apiStatus = { ...apiStatus, state, ...opts, startedAt: null };
      }
      stopElapsedTimer();
    }
    renderApiStatusBadge();
  }

  function startElapsedTimer() {
    stopElapsedTimer();
    elapsedInterval = setInterval(() => {
      if (apiStatus.startedAt) {
        apiStatus.elapsed = (Date.now() - apiStatus.startedAt) / 1000;
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

  function stateIsAvailable() {
    return apiStatus.state === "available";
  }

  function renderApiStatusBadge() {
    const badge = ui.apiStatus;
    let status = apiStatus.state;
    let text = "";
    let elapsedText = "";
    if (
      ["filtering", "checking"].includes(status) &&
      typeof apiStatus.elapsed === "number"
    ) {
      elapsedText = ` (${apiStatus.elapsed.toFixed(1)}s)`;
    } else if (status === "done" && typeof apiStatus.elapsed === "number") {
      elapsedText = ` (${apiStatus.elapsed.toFixed(1)}s)`;
    }
    switch (status) {
      case "checking":
        text = "Checking...";
        break;
      case "available":
        text = "Ready";
        break;
      case "unavailable":
        text = "Not available";
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
        text = "Not available";
        status = "unavailable";
    }
    badge.className = `status-badge status-${status}`;
    badge.textContent = text + elapsedText;
  }

  async function checkApiStatus() {
    setApiStatus("checking");
    const endpoint =
      state.apiMode === "local"
        ? DEFAULT_LOCAL_API_ENDPOINT
        : DEFAULT_REMOTE_API_ENDPOINT;
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
            headers: state.apiKey ? { "X-API-Key": state.apiKey } : {},
          },
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
    if (
      ["done", "error", "available", "unavailable", "auth-failed"].includes(
        apiStatus.state,
      )
    ) {
      setApiStatus("ready");
    }
  }

  const state = {
    filters: [],
    minMatch: 0,
    maxItems: 10,
    maxImagesPerItem: 3,
    apiMode: "remote",
    apiKey: "",
    isConnected: false,
    _listeners: [],
    subscribe(fn) {
      this._listeners.push(fn);
    },
    notify() {
      this._listeners.forEach((fn) => fn());
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
    editFilter(index, newValue) {
      if (!newValue || this.filters.includes(newValue)) return false;
      this.filters[index] = newValue;
      saveState();
      this.notify();
      return true;
    },
    resetFilters() {
      this.filters = [];
      saveState();
      this.notify();
    },
    setMinMatch(val) {
      this.minMatch = Math.max(0, Math.min(val, this.filters.length));
      saveState();
      this.notify();
    },
    setMaxItems(val) {
      this.maxItems = Math.max(1, val);
      saveState();
      this.notify();
    },
    setMaxImagesPerItem(val) {
      this.maxImagesPerItem = Math.max(0, Math.min(10, val));
      saveState();
      this.notify();
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
        ui.notificationArea.appendChild(notification);
      }
    },
  };

  let lastConnectionStatus = null;
  let lastRenderedFilters = null;

  function renderUI() {
    if (ui.filtersSection) {
      ui.filtersSection.style.display = state.isConnected ? "" : "none";
    }

    if (!state.isConnected) {
      document.body.style.minHeight = "0";
      document.body.style.height = "auto";
    } else {
      document.body.style.minHeight = "";
      document.body.style.height = "";
    }

    ui.filtersList.innerHTML = "";
    state.filters.forEach((filter, index) => {
      const badge = createFilterBadge(
        filter,
        () => state.removeFilter(index),
        (newValue) => state.editFilter(index, newValue),
      );
      ui.filtersList.appendChild(badge);
    });
    ui.minMatch.max = state.filters.length;
    ui.minMatch.value = Math.min(state.minMatch, state.filters.length);
    ui.minMatch.disabled = !state.filters.length;
    ui.minMatchValue.textContent = ui.minMatch.value;
    ui.maxItems.value = state.maxItems;
    ui.maxImages.value = state.maxImagesPerItem;
    ui.applyFilters.disabled = !state.filters.length || !state.isConnected;
    ui.resetFilters.disabled = !state.filters.length;
    ui.addFilter.disabled = !ui.filterInput.value.trim();
    ui.apiModeRemote.checked = state.apiMode === "remote";
    ui.apiModeLocal.checked = state.apiMode === "local";
    ui.apiKeyRow.style.display = state.apiMode === "remote" ? "" : "none";
    ui.apiKey.value = state.apiKey;

    const statusIndicator =
      ui.connectionStatus.querySelector("span:first-child");
    let statusText = ui.connectionStatus.querySelector("span:last-child");
    if (!statusText) {
      statusText = document.createElement("span");
      ui.connectionStatus.appendChild(statusText);
    }
    const connected = state.isConnected;
    statusIndicator.className =
      "inline-flex h-4 w-4 rounded-full mr-2 " +
      (connected ? "bg-green-500" : "bg-red-500");
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
      if (!tab?.id) {
        if (state.isConnected !== false) state.setConnection(false);
        return;
      }
      state.currentActiveTab = tab;
      chrome.tabs.sendMessage(tab.id, { type: "PING" }, (response) => {
        const isConnected =
          !chrome.runtime.lastError && response?.type === "PONG";
        if (state.isConnected !== isConnected) {
          state.setConnection(isConnected);
        }
      });
    });
  }

  function bindFilterEvents(sendToContent) {
    ui.addFilter.onclick = () => {
      const value = ui.filterInput.value.trim();
      if (value && state.addFilter(value)) {
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
    ui.resetFilters.onclick = () => {
      state.resetFilters();
      chrome.storage.local.remove("filtergenieLastAnalyzed");
      sendToContent({ type: "RESET_FILTERS_ON_PAGE" });
    };

    ui.applyFilters.onclick = () => {
      resetApiBadgeOnInteraction();
      state.setMaxItems(+ui.maxItems.value);
      state.setMaxImagesPerItem(+ui.maxImages.value);
      ui.applyFilters.disabled = true;
      setApiStatus("filtering");
      const requestStart = Date.now();
      const apiEndpoint =
        state.apiMode === "local"
          ? DEFAULT_LOCAL_API_ENDPOINT
          : DEFAULT_REMOTE_API_ENDPOINT;
      const apiKey = state.apiKey;
      sendToContent({
        type: "APPLY_FILTERS",
        activeFilters: state.filters,
        minMatch: state.minMatch,
        maxItems: state.maxItems,
        maxImagesPerItem: state.maxImagesPerItem,
        apiEndpoint,
        apiKey,
      });
      function apiListener(msg) {
        if (msg.type === "FILTERS_APPLIED") {
          if (msg.success) {
            const totalTime = (Date.now() - requestStart) / 1000;
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

  function bindMatchEvents(sendToContent) {
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

    const debouncedMaxImagesHandler = debounce((value) => {
      state.setMaxImagesPerItem(+value);
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

    ui.maxImages.oninput = (e) => {
      resetApiBadgeOnInteraction();
      debouncedMaxImagesHandler(e.target.value);
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
        checkApiStatus();
      };
    });

    ui.apiKey.oninput = () => {
      state.setApiKey(ui.apiKey.value.trim());
      checkApiStatus();
    };

    if (ui.apiCheckBtn) {
      ui.apiCheckBtn.onclick = () => {
        checkApiStatus();
      };
    }

    if (ui.apiClearCacheBtn) {
      ui.apiClearCacheBtn.onclick = async () => {
        ui.apiClearCacheBtn.disabled = true;
        ui.apiClearCacheStatus.textContent = "Clearing...";
        const endpoint =
          state.apiMode === "remote"
            ? DEFAULT_REMOTE_API_ENDPOINT
            : DEFAULT_LOCAL_API_ENDPOINT;
        try {
          const resp = await fetch(
            endpoint.replace(/\/+$/, "") + "/cache/clear",
            {
              method: "POST",
              headers:
                state.apiKey && state.apiMode === "remote"
                  ? { "X-API-Key": state.apiKey }
                  : {},
            },
          );
          if (resp.ok) {
            ui.apiClearCacheStatus.textContent = "Cleared";
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
        changes.popupMaxImagesPerItem ||
        changes.popupApiMode ||
        changes.popupApiKey ||
        changes.filtergenieApiStatus
      ) {
        loadState();
      }
    });
  }

  function saveState() {
    ignoreNextStorageUpdate = true;
    chrome.storage.local.set({
      popupFilters: state.filters,
      popupMinMatch: state.minMatch,
      popupMaxItems: state.maxItems,
      popupMaxImagesPerItem: state.maxImagesPerItem,
    });
  }

  function loadDefaultsFromHtml() {
    if (!state.filters.length) {
      state.filters = Array.from(ui.filtersList.children)
        .map((li) => li.textContent?.replace(/✖$/, "").trim())
        .filter(Boolean);
    }
    if (!state.minMatch) state.minMatch = Number(ui.minMatch.value);
    if (!state.maxItems) state.maxItems = Number(ui.maxItems.value);
    if (!state.maxImagesPerItem && state.maxImagesPerItem !== 0)
      state.maxImagesPerItem = Number(ui.maxImages.value) || 3;
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
        "popupMaxImagesPerItem",
        "popupApiMode",
        "popupApiKey",
        "filtergenieApiStatus",
      ],
      (res) => {
        loadDefaultsFromHtml();
        if (Array.isArray(res.popupFilters)) state.filters = res.popupFilters;
        if (typeof res.popupMinMatch === "number")
          state.minMatch = res.popupMinMatch;
        if (typeof res.popupMaxItems === "number")
          state.maxItems = res.popupMaxItems;
        if (typeof res.popupMaxImagesPerItem === "number")
          state.maxImagesPerItem = res.popupMaxImagesPerItem;
        if (typeof res.popupApiMode === "string")
          state.apiMode = res.popupApiMode;
        if (typeof res.popupApiKey === "string") state.apiKey = res.popupApiKey;
        if (res.filtergenieApiStatus) apiStatus = res.filtergenieApiStatus;
        renderUI();
        if (cb) cb();
      },
    );
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
    renderApiStatusBadge();
  }

  loadState(() => {
    checkApiStatus();
    setupEvents(sendToContent);
  });
});
