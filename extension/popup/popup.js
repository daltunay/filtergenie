import { DEFAULTS } from "../utils/defaults.js";
import "../platforms/leboncoin.js";
import "../platforms/vinted.js";
import { showSpinner, removeSpinner } from "../utils/spinnerUtils.js";
import {
  DEFAULT_REMOTE_API_ENDPOINT,
  DEFAULT_LOCAL_API_ENDPOINT,
} from "../utils/apiSettings.js";

document.addEventListener("DOMContentLoaded", () => {
  const FILTERS_KEY = "popupFilters";
  const MIN_MATCH_KEY = "popupMinMatch";
  const MAX_ITEMS_KEY = "popupMaxItems";
  function clampMinMatch(minMatch, count) {
    return Math.max(0, Math.min(minMatch, count));
  }
  const listeners = [];
  const state = {
    filters: [...DEFAULTS.filters],
    minMatch: DEFAULTS.minMatch,
    maxItems: DEFAULTS.maxItems,
    apiMode: DEFAULTS.apiMode,
    apiKey: DEFAULTS.apiKey,
    subscribe(fn) {
      listeners.push(fn);
    },
    notify() {
      listeners.forEach((fn) => fn());
    },
    set(key, value) {
      this[key] = value;
      saveState();
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
      this.set("apiMode", mode);
    },
    setApiKey(key) {
      this.set("apiKey", key);
    },
  };
  function saveState() {
    chrome.storage.local.set({
      [FILTERS_KEY]: state.filters,
      [MIN_MATCH_KEY]: state.minMatch,
      [MAX_ITEMS_KEY]: state.maxItems,
    });
  }
  function loadState(cb) {
    chrome.storage.local.get(
      {
        [FILTERS_KEY]: [...DEFAULTS.filters],
        [MIN_MATCH_KEY]: DEFAULTS.minMatch,
        [MAX_ITEMS_KEY]: DEFAULTS.maxItems,
      },
      (res) => {
        state.filters = res[FILTERS_KEY];
        state.minMatch = clampMinMatch(
          typeof res[MIN_MATCH_KEY] === "number"
            ? res[MIN_MATCH_KEY]
            : DEFAULTS.minMatch,
          state.filters.length,
        );
        state.maxItems =
          typeof res[MAX_ITEMS_KEY] === "number"
            ? res[MAX_ITEMS_KEY]
            : DEFAULTS.maxItems;
        state.notify();
        if (cb) cb();
      },
    );
  }
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
    "api-total-time",
  ].forEach((id) => {
    ui[id.replace(/-([a-z])/g, (g) => g[1].toUpperCase())] =
      document.getElementById(id);
  });

  function renderUI() {
    ui.filtersList.innerHTML = "";
    state.filters.forEach((f, i) => {
      const li = document.createElement("li");
      li.textContent = f;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "✖";
      btn.onclick = () => state.removeFilter(i);
      li.appendChild(btn);
      ui.filtersList.appendChild(li);
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
    ui.applyFilters.disabled = !hasFilters;
    ui.resetFilters.disabled = !hasFilters;
    ui.addFilter.disabled = !ui.filterInput.value.trim();
    ui.apiModeRemote.checked = state.apiMode === "remote";
    ui.apiModeLocal.checked = state.apiMode === "local";
    ui.apiKeyRow.style.display = state.apiMode === "remote" ? "" : "none";
    ui.apiKey.value = state.apiKey || "";
    ui.apiAuthRow.style.display = state.apiMode === "remote" ? "" : "none";
    ui.apiAuthBtn.disabled = state.apiMode === "local";
    ui.authStatus.textContent =
      state.apiMode === "local" ? "Not required for local API" : "";
    ui.apiClearCacheRow.style.display = "";
    if (!["remote", "local"].includes(state.apiMode)) {
      ui.clearCacheStatus.textContent = "";
    }
  }

  function bindFilterEvents(sendToContent) {
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
      sendToContent({
        type: "APPLY_FILTERS",
        activeFilters: state.filters,
        minMatch: state.minMatch,
        maxItems: state.maxItems,
      });
      chrome.runtime.onMessage.addListener(function apiStatusListener(msg) {
        if (msg.type === "API_STATUS") {
          const totalTime = (Date.now() - requestStart) / 1000;
          removeSpinner([ui.apiSpinner]);
          ui.apiStatus.textContent = `API status: ${msg.status}`;
          ui.apiTotalTime.textContent = `Total request time: ${totalTime.toFixed(1)}s`;
          chrome.runtime.onMessage.removeListener(apiStatusListener);
          ui.applyFilters.disabled = false;
        }
      });
    };
  }

  function bindMatchEvents(sendToContent) {
    ui.minMatch.oninput = () => {
      state.setMinMatch(+ui.minMatch.value);
      ui.minMatchValue.textContent = ui.minMatch.value;
      sendToContent({
        type: "UPDATE_MIN_MATCH",
        minMatch: state.minMatch,
        maxItems: state.maxItems,
      });
    };
    ui.maxItems.oninput = () => {
      state.setMaxItems(+ui.maxItems.value);
      sendToContent({
        type: "UPDATE_MIN_MATCH",
        minMatch: state.minMatch,
        maxItems: state.maxItems,
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
      const endpoint =
        state.apiMode === "remote"
          ? DEFAULT_REMOTE_API_ENDPOINT
          : DEFAULT_LOCAL_API_ENDPOINT;
      ui.healthStatus.textContent = "Checking...";
      try {
        const resp = await fetch(endpoint.replace(/\/+$/, "") + "/health");
        ui.healthStatus.textContent = resp.ok ? "✅ Healthy" : "❌ Unhealthy";
      } catch {
        ui.healthStatus.textContent = "❌ Error contacting API";
      }
    };
    ui.apiAuthBtn.onclick = async () => {
      if (state.apiMode === "local") return;
      const endpoint = DEFAULT_REMOTE_API_ENDPOINT.replace(/\/+$/, "");
      ui.authStatus.textContent = "Checking...";
      try {
        const resp = await fetch(endpoint + "/auth/check", {
          headers: state.apiKey ? { "X-API-Key": state.apiKey } : {},
        });
        if (resp.ok) {
          ui.authStatus.textContent = "✅ Authenticated";
        } else {
          ui.authStatus.textContent = "❌ Invalid API key";
        }
      } catch {
        ui.authStatus.textContent = "❌ Error contacting API";
      }
    };
    ui.apiClearCacheBtn.onclick = async () => {
      const endpoint =
        state.apiMode === "remote"
          ? DEFAULT_REMOTE_API_ENDPOINT.replace(/\/+$/, "")
          : DEFAULT_LOCAL_API_ENDPOINT.replace(/\/+$/, "");
      ui.clearCacheStatus.textContent = "Clearing...";
      try {
        const resp = await fetch(endpoint + "/cache/clear", {
          method: "POST",
          headers: state.apiKey ? { "X-API-Key": state.apiKey } : {},
        });
        if (resp.ok) {
          const data = await resp.json();
          ui.clearCacheStatus.textContent =
            data.entries_cleared !== undefined
              ? `✅ Cleared (${data.entries_cleared} entries)`
              : "✅ Cleared";
        } else {
          ui.clearCacheStatus.textContent = "❌ Failed to clear cache";
        }
      } catch {
        ui.clearCacheStatus.textContent = "❌ Error contacting API";
      }
    };
  }

  function bindStorageEvents() {
    chrome.storage.onChanged.addListener((changes) => {
      if (
        changes.popupFilters ||
        changes.popupMinMatch ||
        changes.popupMaxItems
      ) {
        loadState(renderUI);
      }
    });
  }

  function bindUIEvents(sendToContent) {
    bindFilterEvents(sendToContent);
    bindMatchEvents(sendToContent);
    bindApiEvents();
    bindStorageEvents();
  }

  function setupEvents(sendToContent) {
    bindUIEvents(sendToContent);
    state.subscribe(renderUI);
  }

  function sendToContent(msg) {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      tab?.id && chrome.tabs.sendMessage(tab.id, msg);
    });
  }

  loadState(() => {
    renderUI();
    setupEvents(sendToContent);
  });
});
