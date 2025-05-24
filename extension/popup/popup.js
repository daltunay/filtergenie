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
import {
  createFilterBadge,
  setDisclaimer,
} from "./components/ui-components.js";
import {
  DEFAULT_REMOTE_API_ENDPOINT,
  DEFAULT_LOCAL_API_ENDPOINT,
} from "../utils/apiSettings.js";
import { platformRegistry } from "../utils/platformRegistry.js";

document.addEventListener("DOMContentLoaded", () => {
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
    "api-check-status",
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

  let apiStatus = {
    state: "unknown",
    message: "",
    elapsed: null,
    startedAt: null,
  };
  let elapsedInterval = null;

  function setApiStatus(state, opts = {}) {
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
      apiStatus = {
        ...apiStatus,
        state,
        ...opts,
        elapsed: apiStatus.startedAt
          ? (Date.now() - apiStatus.startedAt) / 1000
          : apiStatus.elapsed,
        startedAt: null,
      };
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
    if (elapsedInterval)
      clearInterval(elapsedInterval), (elapsedInterval = null);
  }

  function renderApiStatusBadge() {
    const badge = ui.apiStatus;
    let status = apiStatus.state;
    let elapsedText =
      ["filtering", "checking", "done"].includes(status) &&
      typeof apiStatus.elapsed === "number"
        ? ` (${apiStatus.elapsed.toFixed(1)}s)`
        : "";
    let text =
      {
        checking: "Checking...",
        available: "Ready",
        unavailable: "Not available",
        "auth-failed": "Auth failed",
        filtering: "Filtering...",
        done: "Done",
        error: apiStatus.error || "API Error",
      }[status] || "Not available";
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
      if (state.apiMode === "remote") {
        await fetch(endpoint.replace(/\/+$/, "") + "/auth/check", {
          headers: state.apiKey ? { "X-API-Key": state.apiKey } : {},
        });
      } else {
        await fetch(endpoint.replace(/\/+$/, "") + "/health");
      }
      setApiStatus("available");
    } catch {
      setApiStatus("unavailable");
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
    addFilter(filter) {
      if (!filter || this.filters.includes(filter)) return false;
      this.filters.push(filter);
      updateUI();
      return true;
    },
    removeFilter(index) {
      this.filters.splice(index, 1);
      updateUI();
    },
    editFilter(index, newValue) {
      if (!newValue || this.filters.includes(newValue)) return false;
      this.filters[index] = newValue;
      updateUI();
      return true;
    },
    resetFilters() {
      this.filters = [];
      updateUI();
    },
    setMinMatch(val) {
      this.minMatch = Math.max(0, Math.min(val, this.filters.length));
      updateUI();
    },
    setMaxItems(val) {
      this.maxItems = Math.max(1, Math.min(val, 50));
      updateUI();
    },
    setMaxImagesPerItem(val) {
      this.maxImagesPerItem = Math.max(0, Math.min(10, val));
      updateUI();
    },
    setApiMode(mode) {
      if (this.apiMode !== mode) {
        this.apiMode = mode;
        updateUI();
      }
    },
    setApiKey(key) {
      this.apiKey = key;
      updateUI();
    },
    setConnection(isConnected) {
      this.isConnected = isConnected;
      updateUI();
    },
  };

  function getSupportStatus(tabUrl) {
    if (!tabUrl)
      return {
        supported: false,
        onSearchPage: false,
        message: "Unable to detect current page.",
      };
    const platform = platformRegistry.current(tabUrl);
    if (!platform)
      return {
        supported: false,
        onSearchPage: false,
        message: "This website is not supported by FilterGenie.",
      };
    if (!platform.isSearchPage(tabUrl))
      return {
        supported: true,
        onSearchPage: false,
        message: "FilterGenie only works on search result pages.",
      };
    return { supported: true, onSearchPage: true, message: "" };
  }

  function updateSupportStatus() {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      const url = tab?.url;
      const { supported, onSearchPage, message } = getSupportStatus(url);
      setDisclaimer(ui.notificationArea, message);
      ui.applyFilters.disabled =
        !supported ||
        !onSearchPage ||
        !state.filters.length ||
        !state.isConnected;
    });
  }

  function updateUI() {
    document.body.style.minHeight = state.isConnected ? "" : "0";
    document.body.style.height = state.isConnected ? "" : "auto";
    ui.filtersList.innerHTML = "";
    state.filters.forEach((filter, i) =>
      ui.filtersList.appendChild(
        createFilterBadge(
          filter,
          () => state.removeFilter(i),
          (v) => state.editFilter(i, v),
        ),
      ),
    );
    ui.minMatch.max = state.filters.length;
    ui.minMatch.value = Math.min(state.minMatch, state.filters.length);
    ui.minMatch.disabled = !state.filters.length;
    ui.minMatchValue.textContent = ui.minMatch.value;
    ui.maxItems.value = state.maxItems;
    ui.maxImages.value = state.maxImagesPerItem;
    ui.resetFilters.disabled = !state.filters.length;
    ui.addFilter.disabled = !ui.filterInput.value.trim();
    ui.apiModeRemote.checked = state.apiMode === "remote";
    ui.apiModeLocal.checked = state.apiMode === "local";
    ui.apiKeyRow.style.display = state.apiMode === "remote" ? "" : "none";
    ui.apiKey.value = state.apiKey;
    const ind = ui.connectionStatus.querySelector("span:first-child");
    if (ind)
      ind.className =
        "inline-flex h-4 w-4 rounded-full " +
        (state.isConnected ? "bg-green-500" : "bg-red-500");
    ui.apiStatus.innerHTML = "";
    renderApiStatusBadge();
    ui.apiTotalTime.textContent = "";
    updateSupportStatus();
  }

  function checkConnection() {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab?.id) return state.setConnection(false);
      state.currentActiveTab = tab;
      chrome.tabs.sendMessage(tab.id, { type: "PING" }, (response) => {
        state.setConnection(
          !chrome.runtime.lastError && response?.type === "PONG",
        );
      });
    });
  }

  function bindEvents() {
    bindFilterEvents();
    bindMatchEvents();
    bindApiEvents();
    bindApiKeyToggle();
  }

  function bindFilterEvents() {
    ui.addFilter.onclick = onAddFilter;
    ui.filterInput.oninput = onFilterInput;
    ui.filterInput.onkeydown = onFilterInputKeydown;
    ui.resetFilters.onclick = onResetFilters;
    ui.applyFilters.onclick = onApplyFilters;
  }

  function onAddFilter() {
    const value = ui.filterInput.value.trim();
    if (value && state.addFilter(value)) {
      ui.filterInput.value = "";
      ui.addFilter.disabled = true;
    }
  }

  function onFilterInput() {
    ui.addFilter.disabled = !ui.filterInput.value.trim();
  }

  function onFilterInputKeydown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      onAddFilter();
    }
  }

  function onResetFilters() {
    state.resetFilters();
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      const url = tab?.url;
      const platform = url && platformRegistry.current(url);
      if (platform && platform.isSearchPage(url)) {
        sendToContent({ type: "RESET_FILTERS_ON_PAGE" });
      }
    });
  }

  function onApplyFilters() {
    setApiStatus("filtering");
    state.setMaxItems(+ui.maxItems.value);
    state.setMaxImagesPerItem(+ui.maxImages.value);
    ui.applyFilters.disabled = true;
    const requestStart = Date.now();
    const apiEndpoint =
      state.apiMode === "local"
        ? DEFAULT_LOCAL_API_ENDPOINT
        : DEFAULT_REMOTE_API_ENDPOINT;
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      sendToContent({
        type: "APPLY_FILTERS",
        activeFilters: state.filters,
        minMatch: state.minMatch,
        maxItems: state.maxItems,
        maxImagesPerItem: state.maxImagesPerItem,
        apiEndpoint,
        apiKey: state.apiKey,
      });
      function apiListener(msg) {
        if (msg.type === "FILTERS_APPLIED") {
          setApiStatus(
            msg.success ? "done" : "error",
            msg.success
              ? { doneTime: (Date.now() - requestStart) / 1000 }
              : { error: msg.error },
          );
          ui.applyFilters.disabled = false;
          chrome.runtime.onMessage.removeListener(apiListener);
        }
      }
      chrome.runtime.onMessage.addListener(apiListener);
    });
  }

  function bindMatchEvents() {
    const debounceHandler = (fn, key) =>
      debounce((v) => {
        state[key](+v);
        updateUI();
        sendToContent({
          type: "UPDATE_MIN_MATCH",
          minMatch: state.minMatch,
          maxItems: state.maxItems,
        });
      }, 300);
    ui.minMatch.oninput = (e) =>
      debounceHandler(
        state.setMinMatch.bind(state),
        "setMinMatch",
      )(e.target.value);
    ui.maxItems.oninput = (e) =>
      debounceHandler(
        state.setMaxItems.bind(state),
        "setMaxItems",
      )(e.target.value);
    ui.maxImages.oninput = (e) =>
      debounceHandler(
        state.setMaxImagesPerItem.bind(state),
        "setMaxImagesPerItem",
      )(e.target.value);
  }

  function bindApiEvents() {
    if (ui.settingsToggle) {
      ui.settingsToggle.onclick = () => {
        const settings = ui.apiSettings;
        const arrow = document.getElementById("settings-toggle-arrow");
        const expanded = settings.classList.contains("expanded");
        settings.classList.toggle("expanded");
        settings.classList.toggle("hidden", expanded);
        if (arrow)
          arrow.style.transform = expanded ? "rotate(0deg)" : "rotate(180deg)";
      };
      const arrow = document.getElementById("settings-toggle-arrow");
      const settings = ui.apiSettings;
      if (arrow && settings)
        arrow.style.transform = settings.classList.contains("expanded")
          ? "rotate(180deg)"
          : "rotate(0deg)";
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
      ui.apiCheckBtn.onclick = async () => {
        ui.apiCheckStatus.textContent = "Checking...";
        ui.apiCheckStatus.className =
          "text-xs text-primary-300 mt-1 min-h-[1.2em] text-center";
        ui.apiCheckStatus.style.display = "block";
        const endpoint =
          state.apiMode === "local"
            ? DEFAULT_LOCAL_API_ENDPOINT
            : DEFAULT_REMOTE_API_ENDPOINT;
        try {
          if (state.apiMode === "remote") {
            const authResp = await fetch(
              endpoint.replace(/\/+$/, "") + "/auth/check",
              {
                headers: state.apiKey ? { "X-API-Key": state.apiKey } : {},
              },
            );
            if (!authResp.ok) {
              ui.apiCheckStatus.textContent = "Auth failed";
              ui.apiCheckStatus.className =
                "text-xs text-red-400 mt-1 min-h-[1.2em] text-center";
              setApiStatus("auth-failed");
              setTimeout(() => (ui.apiCheckStatus.textContent = ""), 2500);
              return;
            }
          } else {
            await fetch(endpoint.replace(/\/+$/, "") + "/health");
          }
          ui.apiCheckStatus.textContent = "Available";
          ui.apiCheckStatus.className =
            "text-xs text-green-400 mt-1 min-h-[1.2em] text-center";
          setApiStatus("available");
        } catch {
          ui.apiCheckStatus.textContent = "Not available";
          ui.apiCheckStatus.className =
            "text-xs text-red-400 mt-1 min-h-[1.2em] text-center";
          setApiStatus("unavailable");
        }
        setTimeout(() => (ui.apiCheckStatus.textContent = ""), 2500);
      };
    }
    if (ui.apiClearCacheBtn) {
      ui.apiClearCacheBtn.onclick = async () => {
        ui.apiClearCacheBtn.disabled = true;
        ui.apiClearCacheStatus.textContent = "Clearing...";
        ui.apiClearCacheStatus.className =
          "text-xs text-primary-300 mt-1 min-h-[1.2em] text-center";
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
          const data = await resp.json();
          if (data.status === "disabled") {
            ui.apiClearCacheStatus.textContent = "Cache unavailable";
            ui.apiClearCacheStatus.className =
              "text-xs text-yellow-400 mt-1 min-h-[1.2em] text-center";
          } else {
            ui.apiClearCacheStatus.textContent =
              typeof data.entries_cleared === "number"
                ? `Cleared (${data.entries_cleared})`
                : "Cleared";
            ui.apiClearCacheStatus.className =
              "text-xs text-green-400 mt-1 min-h-[1.2em] text-center";
          }
        } catch {
          ui.apiClearCacheStatus.textContent = "Not available";
          ui.apiClearCacheStatus.className =
            "text-xs text-red-400 mt-1 min-h-[1.2em] text-center";
        }
        setTimeout(() => (ui.apiClearCacheStatus.textContent = ""), 2500);
        ui.apiClearCacheBtn.disabled = false;
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
        ? `<svg id="api-key-eye" class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.956 9.956 0 012.042-3.338m1.528-1.712A9.956 9.956 0 0112 5c4.477 0 8.268 2.943 9.542 7a9.956 9.956 0 01-4.293 5.411M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3l18 18" /></svg>`
        : `<svg id="api-key-eye" class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>`;
    };
  }

  function loadPopupState(cb) {
    chrome.storage.local.get(
      [
        "popupFilters",
        "popupMinMatch",
        "popupMaxItems",
        "popupMaxImagesPerItem",
        "popupApiMode",
        "popupApiKey",
      ],
      (res) => {
        if (Array.isArray(res.popupFilters)) state.filters = res.popupFilters;
        if (typeof res.popupMinMatch === "number")
          state.minMatch = res.popupMinMatch;
        if (typeof res.popupMaxItems === "number")
          state.maxItems = res.popupMaxItems;
        if (typeof res.popupMaxImagesPerItem === "number")
          state.maxImagesPerItem = res.popupMaxImagesPerItem;
        if (typeof res.popupApiMode === "string")
          state.apiMode = res.popupApiMode;
        if (typeof res.popupApiKey === "string") state.apiKey = res.popupApiKey; // pragma: allowlist secret
        updateUI();
        if (cb) cb();
      },
    );
  }

  function savePopupState() {
    chrome.storage.local.set({
      popupFilters: state.filters,
      popupMinMatch: state.minMatch,
      popupMaxItems: state.maxItems,
      popupMaxImagesPerItem: state.maxImagesPerItem,
      popupApiMode: state.apiMode,
      popupApiKey: state.apiKey,
    });
  }

  const orig = { ...state };
  [
    "addFilter",
    "removeFilter",
    "editFilter",
    "resetFilters",
    "setMinMatch",
    "setMaxItems",
    "setMaxImagesPerItem",
    "setApiMode",
    "setApiKey",
  ].forEach((fn) => {
    const origFn = state[fn];
    state[fn] = function (...args) {
      const result = origFn.apply(this, args);
      savePopupState();
      return result;
    };
  });

  function setupEvents(sendToContent) {
    bindEvents();
    checkConnection();
    setInterval(checkConnection, 10000);
    updateSupportStatus();
  }

  loadPopupState(() => {
    checkApiStatus();
    setupEvents(sendToContent);
    updateSupportStatus();
  });

  chrome.tabs.onActivated?.addListener(updateSupportStatus);
  chrome.tabs.onUpdated?.addListener(updateSupportStatus);
});
