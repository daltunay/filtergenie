// --- DOM references grouped ---
const UI = {
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
};

// --- FilterManager class ---
class FilterManager {
  constructor(onChange) {
    this.filters = [];
    this.onChange = onChange;
  }
  add(filter) {
    if (filter && !this.filters.includes(filter)) {
      this.filters.push(filter);
      this.onChange();
    }
  }
  remove(idx) {
    if (idx >= 0 && idx < this.filters.length) {
      this.filters.splice(idx, 1);
      this.onChange();
    }
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

// --- UI state helpers ---
function updateButtonStates() {
  const hasFilters = filterManager.count() > 0;
  UI.applyBtn.disabled = !hasFilters;
  UI.resetBtn.disabled = !hasFilters;
  UI.minMatchInput.disabled = !hasFilters;
  UI.addBtn.disabled = UI.filterInput.disabled;
}

function setControlsEnabled(enabled) {
  UI.filterInput.disabled = !enabled;
  UI.addBtn.disabled = !enabled;
  updateButtonStates();
}

function showMessage(msg) {
  let msgDiv = UI.messageDiv;
  if (!msgDiv) {
    msgDiv = document.createElement("div");
    msgDiv.id = "filtergenie-message";
    document.body.insertBefore(msgDiv, document.body.firstChild);
  }
  msgDiv.textContent = msg;
  if (UI.filtersForm) UI.filtersForm.style.display = "none";
}

// --- UI rendering ---
function renderFilters() {
  UI.filtersList.innerHTML = "";
  filterManager.getAll().forEach((filter, idx) => {
    const li = document.createElement("li");
    li.textContent = filter + " ";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "remove-btn";
    btn.setAttribute("data-idx", idx);
    btn.setAttribute("aria-label", "Remove filter");
    btn.textContent = "✖";
    li.appendChild(btn);
    UI.filtersList.appendChild(li);
  });
  UI.minMatchInput.max = filterManager.count();
  if (parseInt(UI.minMatchInput.value, 10) > filterManager.count()) {
    UI.minMatchInput.value = filterManager.count();
  }
  UI.minMatchValue.textContent = UI.minMatchInput.value;
  updateButtonStates();
}

// --- Chrome API helpers ---
function getActiveTab(cb) {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => cb(tab));
}

function sendMessageToContent(msg) {
  getActiveTab((tab) => {
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, msg, (response) => {
        if (chrome.runtime.lastError) {
          if (chrome.runtime.lastError.message.includes("Receiving end does not exist")) {
            showMessage("FilterGenie is only available on supported search pages. Please open a leboncoin search page and try again.");
          }
        }
      });
    } else {
      showMessage("No active tab found. Please select a leboncoin search page.");
    }
  });
}

function loadSettings(cb) {
  if (typeof window.getApiSettings === "function") {
    window.getApiSettings().then(({ apiEndpoint, apiKey }) => cb({ apiEndpoint, apiKey }));
  }
}

function saveSettings() {
  const apiEndpoint = UI.apiEndpointInput.value.trim() || "http://localhost:8000";
  const apiKey = UI.apiKeyInput.value.trim();
  if (typeof window.saveApiSettings === "function") {
    window.saveApiSettings(apiEndpoint, apiKey).then(() => {
      UI.settingsSaved.hidden = false;
      setTimeout(() => {
        UI.settingsSaved.hidden = true;
      }, 1000);
    });
  }
}

// --- Event handlers ---
function onRemoveFilter(e) {
  if (e.target.classList.contains("remove-btn")) {
    filterManager.remove(Number(e.target.dataset.idx));
  }
}

function onAddFilter() {
  const value = UI.filterInput.value.trim();
  if (value) {
    filterManager.add(value);
    UI.filterInput.value = "";
  }
}

function onResetFilters() {
  filterManager.reset();
}

function onFilterInputKeydown(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    onAddFilter();
  }
}

function onApplyFilters() {
  const message = {
    type: "APPLY_FILTERS",
    activeFilters: filterManager.getAll(),
    minMatch: getMinMatch(),
  };
  sendMessageToContent(message);
}

function onMinMatchInput() {
  UI.minMatchValue.textContent = UI.minMatchInput.value;
  sendMessageToContent({
    type: "UPDATE_MIN_MATCH",
    minMatch: getMinMatch(),
  });
}

function getMinMatch() {
  return Math.max(0, parseInt(UI.minMatchInput.value, 10) || 0);
}

async function checkApiHealth() {
  const endpoint = UI.apiEndpointInput.value.trim() || "http://localhost:8000";
  const url = endpoint.replace(/\/+$/, "") + "/health";
  UI.healthStatus.textContent = "Checking...";
  try {
    const resp = await fetch(url, { method: "GET" });
    UI.healthStatus.textContent = resp.ok ? "✅ Healthy" : "❌ Unhealthy";
  } catch {
    UI.healthStatus.textContent = "❌ Error";
  }
}

// --- Initialization ---
const filterManager = new FilterManager(renderFilters);

function initializeUI() {
  UI.minMatchInput.value = 0;
  UI.minMatchInput.max = 0;
  UI.minMatchInput.disabled = true;
  UI.minMatchValue.textContent = "0";
  filterManager.reset();
  updateButtonStates();
}

function checkPlatformAndEnableControls() {
  getActiveTab((tab) => {
    const url = tab?.url || "";
    const registry = window.platformRegistry;
    if (!registry) {
      showMessage("Platform registry not found.");
      setControlsEnabled(false);
      return;
    }
    const platform = registry.getCurrentPlatform(url);
    if (!platform) {
      showMessage("This website is not supported.");
      setControlsEnabled(false);
      return;
    }
    if (!registry.isCurrentPageSearchPage(url)) {
      showMessage("Filtering is only available on search pages.");
      setControlsEnabled(false);
      return;
    }
    setControlsEnabled(true);
  });
}

function init() {
  initializeUI();
  checkPlatformAndEnableControls();
  loadSettings(({ apiEndpoint, apiKey }) => {
    UI.apiEndpointInput.value = apiEndpoint || "http://localhost:8000";
    UI.apiKeyInput.value = apiKey || "";
  });
}

// --- Attach event listeners ---
UI.filtersList.onclick = onRemoveFilter;
UI.addBtn.onclick = onAddFilter;
UI.resetBtn.onclick = onResetFilters;
UI.filterInput.addEventListener("keydown", onFilterInputKeydown);
UI.filtersForm.onsubmit = (e) => e.preventDefault();
UI.applyBtn.onclick = onApplyFilters;
UI.minMatchInput.oninput = onMinMatchInput;
UI.saveSettingsBtn.onclick = saveSettings;
UI.apiHealthBtn.onclick = checkApiHealth;

document.addEventListener("DOMContentLoaded", init);
