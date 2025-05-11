// Minimalist FilterGenie popup logic

const FILTERS_KEY = "popupFilters";
const FILTER_OPTIONS_KEY = "popupFilterOptions";

const state = {
  filters: [],
  minMatch: 0,
  maxItems: 10,
  apiMode: "remote",
  apiKey: "",
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
  "api-response",
].forEach((id) => {
  ui[id.replace(/-([a-z])/g, (g) => g[1].toUpperCase())] =
    document.getElementById(id);
});

function saveState() {
  chrome.storage.local.set({
    [FILTERS_KEY]: state.filters,
    [FILTER_OPTIONS_KEY]: {
      minMatch: state.minMatch,
      maxItems: state.maxItems,
    },
  });
  if (typeof window.saveApiSettings === "function")
    window.saveApiSettings(state.apiMode, state.apiKey);
}

function loadState(cb) {
  // Show loading animation/message
  if (ui.filtergenieMessage) {
    ui.filtergenieMessage.textContent = "Loading...";
    ui.filtergenieMessage.style.display = "";
  }
  chrome.storage.local.get(
    {
      [FILTERS_KEY]: [],
      [FILTER_OPTIONS_KEY]: { minMatch: 0, maxItems: 10 },
    },
    (res) => {
      state.filters = res[FILTERS_KEY];
      state.minMatch = res[FILTER_OPTIONS_KEY].minMatch;
      state.maxItems = res[FILTER_OPTIONS_KEY].maxItems;
      if (typeof window.getApiSettings === "function") {
        window.getApiSettings().then(({ apiMode, apiKey }) => {
          state.apiMode = apiMode;
          state.apiKey = apiKey;
          state.minMatch = clampMinMatch(state.minMatch, state.filters.length);
          if (ui.filtergenieMessage)
            ui.filtergenieMessage.style.display = "none";
          cb();
        });
      } else {
        state.minMatch = clampMinMatch(state.minMatch, state.filters.length);
        if (ui.filtergenieMessage) ui.filtergenieMessage.style.display = "none";
        cb();
      }
    },
  );
}

// Helper to clamp minMatch to valid range
function clampMinMatch(minMatch, filterCount) {
  // min is always 0, max is filterCount
  return Math.max(0, Math.min(minMatch, filterCount));
}

function render() {
  // Filters list
  ui.filtersList.innerHTML = "";
  state.filters.forEach((f, i) => {
    const li = document.createElement("li");
    li.textContent = f;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "✖";
    btn.onclick = () => {
      state.filters.splice(i, 1);
      // Clamp minMatch after removing a filter
      state.minMatch = clampMinMatch(state.minMatch, state.filters.length);
      saveState();
      render();
    };
    li.appendChild(btn);
    ui.filtersList.appendChild(li);
  });
  // Min match slider logic
  ui.minMatch.min = 0;
  ui.minMatch.max = state.filters.length;
  ui.minMatch.value = clampMinMatch(state.minMatch, state.filters.length);
  ui.minMatch.disabled = !state.filters.length;
  ui.minMatchValue.textContent = ui.minMatch.value;
  // Max items
  ui.maxItems.value = state.maxItems;
  // Controls
  const hasFilters = state.filters.length > 0;
  ui.applyFilters.disabled = !hasFilters;
  ui.resetFilters.disabled = !hasFilters;
  ui.addFilter.disabled = !ui.filterInput.value.trim();
  ui.filterInput.disabled = false;
  // API settings
  if (ui.apiModeRemote && ui.apiModeLocal) {
    ui.apiModeRemote.checked = state.apiMode === "remote";
    ui.apiModeLocal.checked = state.apiMode === "local";
    ui.apiKeyRow.style.display = state.apiMode === "remote" ? "" : "none";
  }
  if (ui.apiKey) ui.apiKey.value = state.apiKey || "";
}

function sendToContent(msg) {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab?.id) chrome.tabs.sendMessage(tab.id, msg);
  });
}

function main() {
  document.addEventListener("DOMContentLoaded", () => {
    loadState(() => {
      // After loading state, update UI fields to reflect restored values
      render();
      // Ensure UI fields are synced with state
      if (ui.apiModeRemote && ui.apiModeLocal) {
        ui.apiModeRemote.checked = state.apiMode === "remote";
        ui.apiModeLocal.checked = state.apiMode === "local";
        ui.apiKeyRow.style.display = state.apiMode === "remote" ? "" : "none";
      }
      if (ui.apiKey) ui.apiKey.value = state.apiKey || "";
      if (ui.maxItems) ui.maxItems.value = state.maxItems;
      if (ui.minMatch) {
        ui.minMatch.min = 0;
        ui.minMatch.max = state.filters.length;
        ui.minMatch.value = clampMinMatch(state.minMatch, state.filters.length);
      }
    });

    ui.addFilter.onclick = () => {
      const v = ui.filterInput.value.trim();
      if (v && !state.filters.includes(v)) {
        state.filters.push(v);
        // When adding a filter, if minMatch was 0, set to 1
        if (state.filters.length === 1) state.minMatch = 1;
        saveState();
        ui.filterInput.value = "";
        render();
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
      state.filters = [];
      state.minMatch = 0;
      saveState();
      render();
    };

    ui.minMatch.oninput = () => {
      // Clamp to valid range
      state.minMatch = clampMinMatch(+ui.minMatch.value, state.filters.length);
      saveState();
      ui.minMatchValue.textContent = ui.minMatch.value;
      sendToContent({ type: "UPDATE_MIN_MATCH", minMatch: state.minMatch });
    };

    ui.maxItems.oninput = () => {
      state.maxItems = Math.max(1, +ui.maxItems.value);
      saveState();
    };

    ui.applyFilters.onclick = () => {
      ui.applyFilters.disabled = true;
      sendToContent({
        type: "APPLY_FILTERS",
        activeFilters: state.filters,
        minMatch: state.minMatch,
        maxItems: state.maxItems,
      });
    };

    if (ui.apiModeRemote && ui.apiModeLocal) {
      ui.apiModeRemote.onchange = ui.apiModeLocal.onchange = () => {
        state.apiMode = ui.apiModeRemote.checked ? "remote" : "local";
        render();
        saveState();
      };
    }
    if (ui.apiKey) {
      ui.apiKey.oninput = () => {
        state.apiKey = ui.apiKey.value.trim();
        saveState();
      };
    }

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
      if (changes[FILTERS_KEY] || changes[FILTER_OPTIONS_KEY]) {
        loadState(render);
      }
    });
  });
}

main();
// ...no more code...
