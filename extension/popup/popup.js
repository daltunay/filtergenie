const ui = {
  filtersForm: document.getElementById("filters-form"),
  filterInput: document.getElementById("filter-input"),
  filtersList: document.getElementById("filters-list"),
  addBtn: document.getElementById("add-filter"),
  applyBtn: document.getElementById("apply-filters"),
  resetBtn: document.getElementById("reset-filters"),
  minMatchInput: document.getElementById("min-match"),
  minMatchValue: document.getElementById("min-match-value"),
  apiEndpointInput: document.getElementById("api-endpoint"),
  apiKeyInput: document.getElementById("api-key"),
  saveSettingsBtn: document.getElementById("save-settings"),
  settingsSaved: document.getElementById("settings-saved"),
  messageDiv: document.getElementById("filtergenie-message"),
  apiHealthBtn: document.getElementById("api-health-btn"),
  healthStatus: document.getElementById("health-status"),
  maxItemsInput: document.getElementById("max-items"),
};

class FilterManager {
  constructor(onChange) {
    this.filters = [];
    this.onChange = onChange;
  }
  add(f) {
    if (f && !this.filters.includes(f)) {
      this.filters.push(f);
      this.onChange();
    }
  }
  remove(idx) {
    this.filters.splice(idx, 1);
    this.onChange();
  }
  reset() {
    this.filters = [];
    this.onChange();
  }
  getAll() {
    return this.filters;
  }
  count() {
    return this.filters.length;
  }
}

function updateButtonStates() {
  const hasFilters = filterManager.count() > 0;
  ui.applyBtn.disabled = !hasFilters;
  ui.resetBtn.disabled = !hasFilters;
  ui.minMatchInput.disabled = !hasFilters;
  ui.addBtn.disabled = ui.filterInput.disabled;
}

function setControlsEnabled(enabled) {
  ui.filterInput.disabled = !enabled;
  ui.addBtn.disabled = !enabled;
  ui.applyBtn.disabled = !enabled || filterManager.count() === 0;
  ui.resetBtn.disabled = !enabled || filterManager.count() === 0;
  ui.minMatchInput.disabled = !enabled || filterManager.count() === 0;
}

function showMessage(msg) {
  ui.messageDiv.textContent = msg;
  if (ui.filtersForm) ui.filtersForm.style.display = "none";
}

function renderFilters() {
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
  ui.minMatchInput.max = filterManager.count();
  if (+ui.minMatchInput.value > filterManager.count())
    ui.minMatchInput.value = filterManager.count();
  ui.minMatchValue.textContent = ui.minMatchInput.value;
  if (ui.maxItemsInput && !ui.maxItemsInput.value) ui.maxItemsInput.value = 10;
  updateButtonStates();
}

function getActiveTab(cb) {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => cb(tab));
}

function sendMessageToContent(msg) {
  getActiveTab((tab) => {
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, msg, () => {
        if (
          chrome.runtime.lastError?.message?.includes(
            "Receiving end does not exist",
          )
        )
          showMessage("Not available on this page.");
      });
    } else showMessage("No active tab.");
  });
}

function loadSettings(cb) {
  if (typeof window.getApiSettings === "function")
    window
      .getApiSettings()
      .then(({ apiEndpoint, apiKey }) => cb({ apiEndpoint, apiKey }));
}

function saveSettings() {
  let apiEndpoint = ui.apiEndpointInput.value.trim() || "http://localhost:8000";
  apiEndpoint = apiEndpoint.replace(/\/+$/, "");
  const apiKey = ui.apiKeyInput.value.trim();
  if (typeof window.saveApiSettings === "function")
    window.saveApiSettings(apiEndpoint, apiKey).then(() => {
      ui.settingsSaved.hidden = false;
      setTimeout(() => {
        ui.settingsSaved.hidden = true;
      }, 1000);
    });
}

const filterManager = new FilterManager(renderFilters);

ui.filtersList.onclick = (e) => {
  if (e.target.classList.contains("remove-btn"))
    filterManager.remove(+e.target.dataset.idx);
};
ui.addBtn.onclick = () => {
  const v = ui.filterInput.value.trim();
  if (v) {
    filterManager.add(v);
    ui.filterInput.value = "";
  }
};
ui.resetBtn.onclick = () => filterManager.reset();
ui.filterInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    ui.addBtn.onclick();
  }
});
ui.filtersForm.onsubmit = (e) => e.preventDefault();
ui.applyBtn.onclick = () =>
  sendMessageToContent({
    type: "APPLY_FILTERS",
    activeFilters: filterManager.getAll(),
    minMatch: Math.max(0, +ui.minMatchInput.value || 0),
    maxItems: Math.max(1, +ui.maxItemsInput.value || 10),
  });
ui.minMatchInput.oninput = () => {
  ui.minMatchValue.textContent = ui.minMatchInput.value;
  sendMessageToContent({
    type: "UPDATE_MIN_MATCH",
    minMatch: Math.max(0, +ui.minMatchInput.value || 0),
  });
};
ui.saveSettingsBtn.onclick = saveSettings;
ui.apiHealthBtn.onclick = async () => {
  let endpoint = ui.apiEndpointInput.value.trim() || "http://localhost:8000";
  endpoint = endpoint.replace(/\/+$/, "");
  ui.healthStatus.textContent = "Checking...";
  try {
    const resp = await fetch(endpoint + "/health");
    ui.healthStatus.textContent = resp.ok ? "✅ Healthy" : "❌ Unhealthy";
  } catch {
    ui.healthStatus.textContent = "❌ Error";
  }
};

function initializeUI() {
  ui.minMatchInput.value = 0;
  ui.minMatchInput.max = 0;
  ui.minMatchInput.disabled = true;
  ui.minMatchValue.textContent = "0";
  if (ui.maxItemsInput) ui.maxItemsInput.value = 10;
  filterManager.filters = [];
  renderFilters();
  setControlsEnabled(false);
}

function checkPlatformAndEnableControls() {
  getActiveTab((tab) => {
    const url = tab?.url || "";
    const reg = window.platformRegistry;
    if (!reg) return showMessage("No registry."), setControlsEnabled(false);
    const platform = reg.getCurrentPlatform(url);
    if (!platform)
      return showMessage("Not supported."), setControlsEnabled(false);
    if (!reg.isCurrentPageSearchPage(url))
      return showMessage("Only on search pages."), setControlsEnabled(false);
    setControlsEnabled(true);
  });
}

function init() {
  initializeUI();
  checkPlatformAndEnableControls();
  loadSettings(({ apiEndpoint, apiKey }) => {
    ui.apiEndpointInput.value = apiEndpoint || "http://localhost:8000";
    ui.apiKeyInput.value = apiKey || "";
  });
}

document.addEventListener("DOMContentLoaded", init);
