document.addEventListener("DOMContentLoaded", () => {
  if (!window.DEFAULTS) {
    console.error("DEFAULTS not loaded!");
    return;
  }

  const FILTERS_KEY = "popupFilters";
  const FILTER_OPTIONS_KEY = "popupFilterOptions";

  const listeners = [];
  const state = {
    filters: [...window.DEFAULTS.filters],
    minMatch: window.DEFAULTS.minMatch,
    maxItems: window.DEFAULTS.maxItems,
    apiMode: window.DEFAULTS.apiMode,
    apiKey: window.DEFAULTS.apiKey,
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

  function clampMinMatch(minMatch, count) {
    return Math.max(0, Math.min(minMatch, count));
  }

  function saveState() {
    chrome.storage.local.set({
      [FILTERS_KEY]: state.filters,
      [FILTER_OPTIONS_KEY]: {
        minMatch: state.minMatch,
        maxItems: state.maxItems,
      },
    });
    window.saveApiSettings?.(state.apiMode, state.apiKey);
  }

  function loadState(cb) {
    chrome.storage.local.get(
      {
        [FILTERS_KEY]: [...window.DEFAULTS.filters],
        [FILTER_OPTIONS_KEY]: {
          minMatch: window.DEFAULTS.minMatch,
          maxItems: window.DEFAULTS.maxItems,
        },
      },
      (res) => {
        state.filters = res[FILTERS_KEY];
        state.minMatch = clampMinMatch(
          res[FILTER_OPTIONS_KEY].minMatch,
          state.filters.length,
        );
        state.maxItems = res[FILTER_OPTIONS_KEY].maxItems;
        if (window.getApiSettings) {
          window.getApiSettings().then(({ apiMode, apiKey }) => {
            state.apiMode = apiMode;
            state.apiKey = apiKey;
            state.notify();
            cb && cb();
          });
        } else {
          state.notify();
          cb && cb();
        }
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

    if (ui.apiModeRemote && ui.apiModeLocal) {
      ui.apiModeRemote.checked = state.apiMode === "remote";
      ui.apiModeLocal.checked = state.apiMode === "local";
      ui.apiKeyRow.style.display = state.apiMode === "remote" ? "" : "none";
    }
    if (ui.apiKey) ui.apiKey.value = state.apiKey || "";

    if (ui.apiAuthRow) {
      ui.apiAuthRow.style.display = state.apiMode === "remote" ? "" : "none";
      if (state.apiMode !== "remote" && ui.authStatus) {
        ui.authStatus.textContent = "";
      }
    }

    if (ui.apiAuthBtn && ui.authStatus) {
      if (state.apiMode === "local") {
        ui.apiAuthBtn.disabled = true;
        ui.authStatus.textContent = "Not required for local API";
      } else {
        ui.apiAuthBtn.disabled = false;
        ui.authStatus.textContent = "";
      }
    }

    if (ui.apiClearCacheRow) {
      ui.apiClearCacheRow.style.display = "";
      if (ui.clearCacheStatus && !["remote", "local"].includes(state.apiMode)) {
        ui.clearCacheStatus.textContent = "";
      }
    }
  }

  function setInitialUIValues() {
    ui.minMatch.value = window.DEFAULTS.minMatch;
    ui.minMatch.min = 0;
    ui.minMatch.max = 0;
    ui.minMatchValue.textContent = window.DEFAULTS.minMatch;
    ui.maxItems.value = window.DEFAULTS.maxItems;
    if (ui.apiModeRemote)
      ui.apiModeRemote.checked = window.DEFAULTS.apiMode === "remote";
    if (ui.apiModeLocal)
      ui.apiModeLocal.checked = window.DEFAULTS.apiMode === "local";
    if (ui.apiKey) ui.apiKey.value = window.DEFAULTS.apiKey;
  }

  function bindUIEvents(sendToContent) {
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

    ui.applyFilters.onclick = () => {
      if (ui.maxItems) state.setMaxItems(+ui.maxItems.value);
      ui.applyFilters.disabled = true;
      sendToContent({
        type: "APPLY_FILTERS",
        activeFilters: state.filters,
        minMatch: state.minMatch,
        maxItems: state.maxItems,
      });
    };

    if (ui.apiModeRemote && ui.apiModeLocal) {
      [ui.apiModeRemote, ui.apiModeLocal].forEach((el) => {
        el.onchange = () => {
          state.setApiMode(ui.apiModeRemote.checked ? "remote" : "local");
          if (ui.healthStatus) ui.healthStatus.textContent = "";
          if (ui.authStatus) ui.authStatus.textContent = "";
          if (ui.clearCacheStatus) ui.clearCacheStatus.textContent = "";
        };
      });
    }

    if (ui.apiKey)
      ui.apiKey.oninput = () => state.setApiKey(ui.apiKey.value.trim());

    ui.apiHealthBtn.onclick = async () => {
      const endpoint =
        state.apiMode === "remote"
          ? window.DEFAULT_REMOTE_API_ENDPOINT
          : window.DEFAULT_LOCAL_API_ENDPOINT;
      ui.healthStatus.textContent = "Checking...";
      try {
        const resp = await fetch(endpoint.replace(/\/+$/, "") + "/health");
        ui.healthStatus.textContent = resp.ok ? "✅ Healthy" : "❌ Unhealthy";
      } catch {
        ui.healthStatus.textContent = "❌ Error contacting API";
      }
    };

    if (ui.apiAuthBtn) {
      ui.apiAuthBtn.onclick = async () => {
        if (state.apiMode === "local") return;
        const endpoint = window.DEFAULT_REMOTE_API_ENDPOINT.replace(/\/+$/, "");
        ui.authStatus.textContent = "Checking...";
        try {
          const resp = await fetch(endpoint + "/auth/check", {
            headers: state.apiKey
              ? { Authorization: `Bearer ${state.apiKey}` }
              : {},
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
    }

    if (ui.apiClearCacheBtn) {
      ui.apiClearCacheBtn.onclick = async () => {
        const endpoint =
          state.apiMode === "remote"
            ? window.DEFAULT_REMOTE_API_ENDPOINT.replace(/\/+$/, "")
            : window.DEFAULT_LOCAL_API_ENDPOINT.replace(/\/+$/, "");
        ui.clearCacheStatus.textContent = "Clearing...";
        try {
          const resp = await fetch(endpoint + "/cache/clear", {
            method: "POST",
            headers: state.apiKey
              ? { Authorization: `Bearer ${state.apiKey}` }
              : {},
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

    chrome.storage.onChanged.addListener((changes) => {
      if (changes.popupFilters || changes.popupFilterOptions) {
        window.loadStateAndRender();
      }
    });
  }

  function render() {
    renderUI();
  }

  function setupEvents(sendToContent) {
    setInitialUIValues();
    bindUIEvents(sendToContent);
    state.subscribe(renderUI);
  }

  function sendToContent(msg) {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      tab?.id && chrome.tabs.sendMessage(tab.id, msg);
    });
  }

  window.loadStateAndRender = () => loadState();

  loadState(() => {
    render();
    setupEvents(sendToContent);
  });
});
