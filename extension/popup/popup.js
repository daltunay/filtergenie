// FilterGenie popup UI logic

function getUI() {
  const ids = [
    "filters-form",
    "filter-input",
    "filters-list",
    "add-filter",
    "apply-filters",
    "reset-filters",
    "min-match",
    "min-match-value",
    "api-mode-remote",
    "api-mode-local",
    "api-key-row",
    "api-key",
    "filtergenie-message",
    "api-health-btn",
    "health-status",
    "max-items",
    "api-response",
  ];
  const ui = {};
  ids.forEach((id) => {
    const key = id.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    ui[key] = document.getElementById(id);
  });
  return ui;
}

const state = {
  controlsEnabled: false,
  filters: [],
};

class FilterManager {
  constructor(onChange) {
    this.onChange = onChange;
    this.load();
  }
  add(filter) {
    if (filter && !state.filters.includes(filter)) {
      state.filters.push(filter);
      this.save();
      this.onChange();
    }
  }
  remove(idx) {
    state.filters.splice(idx, 1);
    this.save();
    this.onChange();
  }
  reset() {
    state.filters = [];
    this.save();
    this.onChange();
  }
  getAll() {
    return state.filters;
  }
  count() {
    return state.filters.length;
  }
  save() {
    chrome.storage.local.set({ filterGenieFilters: state.filters });
  }
  load() {
    chrome.storage.local.get({ filterGenieFilters: [] }, (result) => {
      state.filters = Array.isArray(result.filterGenieFilters)
        ? result.filterGenieFilters
        : [];
      this.onChange();
    });
  }
}

function renderFilters(ui, filterManager) {
  ui.filtersList.innerHTML = "";
  filterManager.getAll().forEach((filter, idx) => {
    const li = document.createElement("li");
    li.textContent = filter + " ";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "remove-btn";
    btn.dataset.idx = idx;
    btn.ariaLabel = "Remove filter";
    btn.textContent = "✖";
    li.appendChild(btn);
    ui.filtersList.appendChild(li);
  });
  ui.minMatch.max = filterManager.count();
  if (+ui.minMatch.value > filterManager.count())
    ui.minMatch.value = filterManager.count();
  ui.minMatchValue.textContent = ui.minMatch.value;
  updateControlStates(ui, filterManager);
}

function updateControlStates(ui, filterManager) {
  const hasFilters = filterManager.count() > 0;
  const enabled = state.controlsEnabled;
  ui.applyFilters.disabled = !enabled || !hasFilters;
  ui.resetFilters.disabled = !enabled || !hasFilters;
  ui.minMatch.disabled = !enabled || !hasFilters;
  ui.addFilter.disabled = !enabled || ui.filterInput.disabled;
  ui.filterInput.disabled = !enabled;
}

function showMessage(ui, msg) {
  ui.filtergenieMessage.textContent = msg;
}

function clearMessage(ui) {
  ui.filtergenieMessage.textContent = "";
  if (ui.filtersForm) ui.filtersForm.style.display = "";
}

function setApiResponse(ui, status, error) {
  if (!ui.apiResponse) return;
  if (status === undefined || status === null) {
    ui.apiResponse.textContent = "";
    return;
  }
  if (error && status !== 200) {
    ui.apiResponse.textContent = `API error (${status}): ${error}`;
  } else {
    ui.apiResponse.textContent = `API status: ${status}`;
  }
}

let loadingInterval = null;

function startLoadingAnimation(ui) {
  if (!ui.apiResponse) return;
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  ui.apiResponse.textContent = "Loading... " + frames[0];
  loadingInterval = setInterval(() => {
    ui.apiResponse.textContent = "Loading... " + frames[i % frames.length];
    i++;
  }, 100);
}

function stopLoadingAnimation() {
  if (loadingInterval) {
    clearInterval(loadingInterval);
    loadingInterval = null;
  }
}

function loadSettings(cb) {
  if (typeof window.getApiSettings === "function")
    window
      .getApiSettings()
      .then(({ apiMode, apiKey }) => cb({ apiMode, apiKey }));
}

function saveSettings(ui) {
  const apiMode = ui.apiModeRemote.checked ? "remote" : "local";
  const apiKey = apiMode === "remote" ? ui.apiKey.value.trim() : "";
  if (typeof window.saveApiSettings === "function")
    window.saveApiSettings(apiMode, apiKey);
}

function updateApiKeyVisibility(ui) {
  const isRemote = ui.apiModeRemote.checked;
  if (ui.apiKeyRow) ui.apiKeyRow.style.display = isRemote ? "" : "none";
}

function getActiveTab(cb) {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => cb(tab));
}

function sendMessageToContent(msg, ui) {
  getActiveTab((tab) => {
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, msg, (response) => {
        if (
          chrome.runtime.lastError?.message?.includes(
            "Receiving end does not exist",
          )
        ) {
          showMessage(ui, "Not available on this page.");
          setApiResponse(ui);
        }
      });
    } else {
      showMessage(ui, "No active tab.");
      setApiResponse(ui);
    }
  });
}

function setupRuntimeListener(ui, filterManager) {
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "API_STATUS") {
      stopLoadingAnimation();
      setApiResponse(ui, msg.status, msg.error);
      updateControlStates(ui, filterManager);
    }
  });
}

function setControlsEnabled(enabled, ui, filterManager) {
  state.controlsEnabled = enabled;
  updateControlStates(ui, filterManager);
}

function initializeUI(ui, filterManager) {
  ui.minMatch.value = 0;
  ui.minMatch.max = 0;
  ui.minMatch.disabled = true;
  ui.minMatchValue.textContent = "0";
  state.filters = [];
  renderFilters(ui, filterManager);
  setControlsEnabled(false, ui, filterManager);
  setApiResponse(ui);
  clearMessage(ui);
}

function checkPlatformAndEnableControls(ui, filterManager) {
  getActiveTab((tab) => {
    const url = tab?.url || "";
    const reg = window.platformRegistry;
    if (!reg) {
      showMessage(ui, "No registry.");
      setControlsEnabled(false, ui, filterManager);
      if (ui.filtersForm) ui.filtersForm.style.display = "none";
      return;
    }
    const platform = reg.getCurrentPlatform(url);
    if (!platform) {
      showMessage(ui, "Not supported.");
      setControlsEnabled(false, ui, filterManager);
      if (ui.filtersForm) ui.filtersForm.style.display = "none";
      return;
    }
    if (!reg.isCurrentPageSearchPage(url)) {
      showMessage(ui, "Only on search pages.");
      setControlsEnabled(false, ui, filterManager);
      if (ui.filtersForm) ui.filtersForm.style.display = "none";
      return;
    }
    clearMessage(ui);
    setControlsEnabled(true, ui, filterManager);
    if (ui.filtersForm) ui.filtersForm.style.display = "";
  });
}

function bindEvents(ui, filterManager) {
  ui.filtersList.onclick = (e) => {
    if (e.target.classList.contains("remove-btn"))
      filterManager.remove(+e.target.dataset.idx);
  };
  ui.addFilter.onclick = () => {
    const v = ui.filterInput.value.trim();
    if (v) {
      filterManager.add(v);
      ui.filterInput.value = "";
    }
  };
  ui.resetFilters.onclick = () => filterManager.reset();
  ui.filterInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      ui.addFilter.onclick();
    }
  });
  ui.filtersForm.onsubmit = (e) => e.preventDefault();
  ui.applyFilters.onclick = () => {
    ui.applyFilters.disabled = true;
    startLoadingAnimation(ui);
    sendMessageToContent(
      {
        type: "APPLY_FILTERS",
        activeFilters: filterManager.getAll(),
        minMatch: Math.max(0, +ui.minMatch.value || 0),
        maxItems: Math.max(1, +ui.maxItems.value),
      },
      ui,
    );
  };
  ui.minMatch.oninput = () => {
    ui.minMatchValue.textContent = ui.minMatch.value;
    sendMessageToContent(
      {
        type: "UPDATE_MIN_MATCH",
        minMatch: Math.max(0, +ui.minMatch.value || 0),
      },
      ui,
    );
  };
  if (ui.apiModeRemote && ui.apiModeLocal) {
    ui.apiModeRemote.onchange = () => {
      updateApiKeyVisibility(ui);
      saveSettings(ui);
    };
    ui.apiModeLocal.onchange = () => {
      updateApiKeyVisibility(ui);
      saveSettings(ui);
    };
  }
  if (ui.apiKey) {
    ui.apiKey.addEventListener("input", () => {
      saveSettings(ui);
    });
  }
  ui.apiHealthBtn.onclick = async () => {
    const apiMode = ui.apiModeRemote.checked ? "remote" : "local";
    let endpoint =
      apiMode === "remote"
        ? window.DEFAULT_REMOTE_API_ENDPOINT
        : window.DEFAULT_LOCAL_API_ENDPOINT;
    endpoint = endpoint.replace(/\/+$/, "");
    ui.healthStatus.textContent = "Checking...";
    try {
      const resp = await fetch(endpoint + "/health");
      ui.healthStatus.textContent = resp.ok ? "✅ Healthy" : "❌ Unhealthy";
    } catch {
      ui.healthStatus.textContent = "❌ Unavailable";
    }
  };
}

function main() {
  document.addEventListener("DOMContentLoaded", () => {
    const ui = getUI();
    Object.entries(ui).forEach(([key, el]) => {
      if (!el) console.warn(`UI element missing: ${key}`);
    });
    const filterManager = new FilterManager(() =>
      renderFilters(ui, filterManager),
    );
    initializeUI(ui, filterManager);
    bindEvents(ui, filterManager);
    filterManager.load();
    checkPlatformAndEnableControls(ui, filterManager);
    loadSettings(({ apiMode, apiKey }) => {
      if (ui.apiModeRemote && ui.apiModeLocal) {
        if (apiMode === "remote") {
          ui.apiModeRemote.checked = true;
        } else {
          ui.apiModeLocal.checked = true;
        }
        updateApiKeyVisibility(ui);
      }
      ui.apiKey.value = apiKey || "";
    });
    setupRuntimeListener(ui, filterManager);
  });
}

main();
