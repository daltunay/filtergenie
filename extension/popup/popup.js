const DEFAULTS = {
  filters: [],
  appliedFilters: [],
  minMatch: 0,
  maxItems: 10,
  apiMode: "local",
  apiKey: "",
};

const FILTERS_KEY = "popupFilters";
const APPLIED_FILTERS_KEY = "popupAppliedFilters";
const FILTER_OPTIONS_KEY = "popupFilterOptions";

const listeners = [];

const state = {
  filters: [...DEFAULTS.filters],
  appliedFilters: [...DEFAULTS.appliedFilters],
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
  setFilters(filters) {
    this.filters = filters;
    saveState();
    this.notify();
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
    this.filters = [];
    saveState();
    this.notify();
  },
  setMinMatch(val) {
    this.minMatch = clampMinMatch(val, this.appliedFilters.length);
    saveState();
    this.notify();
  },
  setMaxItems(val) {
    this.maxItems = Math.max(1, val);
    saveState();
    this.notify();
  },
  setApiMode(mode) {
    this.apiMode = mode;
    saveState();
    this.notify();
  },
  setApiKey(key) {
    this.apiKey = key;
    saveState();
    this.notify();
  },
  setAppliedFilters(filters) {
    this.appliedFilters = [...filters];
    this.minMatch = clampMinMatch(this.minMatch, this.appliedFilters.length);
    saveState();
    this.notify();
  },
};

function clampMinMatch(minMatch, count) {
  return Math.max(0, Math.min(minMatch, count));
}

function saveState() {
  chrome.storage.local.set({
    [FILTERS_KEY]: state.filters,
    [APPLIED_FILTERS_KEY]: state.appliedFilters,
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
      [FILTERS_KEY]: [...DEFAULTS.filters],
      [APPLIED_FILTERS_KEY]: [...DEFAULTS.appliedFilters],
      [FILTER_OPTIONS_KEY]: {
        minMatch: DEFAULTS.minMatch,
        maxItems: DEFAULTS.maxItems,
      },
    },
    (res) => {
      state.filters = res[FILTERS_KEY];
      state.appliedFilters = res[APPLIED_FILTERS_KEY];
      state.minMatch = res[FILTER_OPTIONS_KEY].minMatch;
      state.maxItems = res[FILTER_OPTIONS_KEY].maxItems;
      const finish = () => {
        state.minMatch = clampMinMatch(
          state.minMatch,
          state.appliedFilters.length,
        );
        state.notify();
        cb && cb();
      };
      if (window.getApiSettings) {
        window.getApiSettings().then(({ apiMode, apiKey }) => {
          state.apiMode = apiMode;
          state.apiKey = apiKey;
          finish();
        });
      } else {
        finish();
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
  "api-response",
  "applied-filters-list",
].forEach((id) => {
  ui[id.replace(/-([a-z])/g, (g) => g[1].toUpperCase())] =
    document.getElementById(id);
});

function renderUI(state) {
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

  if (ui.appliedFiltersList) {
    ui.appliedFiltersList.innerHTML = "";
    state.appliedFilters.forEach((f) => {
      const li = document.createElement("li");
      li.textContent = f;
      ui.appliedFiltersList.appendChild(li);
    });
  }

  Object.assign(ui.minMatch, {
    min: 0,
    max: Math.max(0, state.appliedFilters.length),
    value: clampMinMatch(state.minMatch, state.appliedFilters.length),
    disabled: !state.appliedFilters.length,
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
  ui.apiKey && (ui.apiKey.value = state.apiKey || "");
}

function setInitialUIValues() {
  if (ui.minMatch) {
    ui.minMatch.value = DEFAULTS.minMatch;
    ui.minMatch.min = 0;
    ui.minMatch.max = 0;
  }
  if (ui.minMatchValue) ui.minMatchValue.textContent = DEFAULTS.minMatch;
  if (ui.maxItems) ui.maxItems.value = DEFAULTS.maxItems;
  if (ui.apiModeRemote)
    ui.apiModeRemote.checked = DEFAULTS.apiMode === "remote";
  if (ui.apiModeLocal) ui.apiModeLocal.checked = DEFAULTS.apiMode === "local";
  if (ui.apiKey) ui.apiKey.value = DEFAULTS.apiKey;
}

function bindUIEvents(sendToContent) {
  ui.addFilter.onclick = () => {
    const v = ui.filterInput.value.trim();
    if (v) state.addFilter(v);
    ui.filterInput.value = "";
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
    sendToContent({ type: "UPDATE_MIN_MATCH", minMatch: state.minMatch });
  };

  ui.maxItems.oninput = () => state.setMaxItems(+ui.maxItems.value);

  ui.applyFilters.onclick = () => {
    if (ui.maxItems) {
      state.setMaxItems(+ui.maxItems.value);
    }
    ui.applyFilters.disabled = true;
    state.setAppliedFilters(state.filters);
    sendToContent({
      type: "APPLY_FILTERS",
      activeFilters: state.appliedFilters,
      minMatch: state.minMatch,
      maxItems: state.maxItems,
    });
  };

  if (ui.apiModeRemote && ui.apiModeLocal) {
    [ui.apiModeRemote, ui.apiModeLocal].forEach((el) => {
      el.onchange = () => {
        state.setApiMode(ui.apiModeRemote.checked ? "remote" : "local");
      };
    });
  }

  ui.apiKey &&
    (ui.apiKey.oninput = () => state.setApiKey(ui.apiKey.value.trim()));

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
      ui.healthStatus.textContent = "❌ Unavailable";
    }
  };

  chrome.storage.onChanged.addListener((changes) => {
    if (
      changes.popupFilters ||
      changes.popupAppliedFilters ||
      changes.popupFilterOptions
    ) {
      window.loadStateAndRender();
    }
  });
}

function render() {
  renderUI(state);
}

function setupEvents(sendToContent) {
  setInitialUIValues();
  bindUIEvents(sendToContent);
  state.subscribe(() => renderUI(state));
}

function sendToContent(msg) {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    tab?.id && chrome.tabs.sendMessage(tab.id, msg);
  });
}

window.loadStateAndRender = () => loadState();

document.addEventListener("DOMContentLoaded", () => {
  loadState(() => {
    render();
    setupEvents(sendToContent);
  });
});
