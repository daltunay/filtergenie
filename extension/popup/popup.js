const uiElements = {
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

function updateButtonStates() {
  const hasFilters = filterManager.count() > 0;
  uiElements.applyBtn.disabled = !hasFilters;
  uiElements.resetBtn.disabled = !hasFilters;
  uiElements.minMatchInput.disabled = !hasFilters;
  uiElements.addBtn.disabled = uiElements.filterInput.disabled;
}

function setControlsEnabled(enabled) {
  uiElements.filterInput.disabled = !enabled;
  uiElements.addBtn.disabled = !enabled;
  updateButtonStates();
}

function showMessage(msg) {
  let msgDiv = uiElements.messageDiv;
  if (!msgDiv) {
    msgDiv = document.createElement("div");
    msgDiv.id = "filtergenie-message";
    document.body.insertBefore(msgDiv, document.body.firstChild);
  }
  msgDiv.textContent = msg;
  if (uiElements.filtersForm) uiElements.filtersForm.style.display = "none";
}

function renderFilters() {
  uiElements.filtersList.innerHTML = "";
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
    uiElements.filtersList.appendChild(li);
  });
  uiElements.minMatchInput.max = filterManager.count();
  if (parseInt(uiElements.minMatchInput.value, 10) > filterManager.count()) {
    uiElements.minMatchInput.value = filterManager.count();
  }
  uiElements.minMatchValue.textContent = uiElements.minMatchInput.value;
  updateButtonStates();
}

function getActiveTab(cb) {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => cb(tab));
}

function sendMessageToContent(msg) {
  getActiveTab((tab) => {
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, msg, () => {
        if (chrome.runtime.lastError) {
          if (
            chrome.runtime.lastError.message.includes(
              "Receiving end does not exist",
            )
          ) {
            showMessage("Not available on this page.");
          }
        }
      });
    } else {
      showMessage("No active tab.");
    }
  });
}

function loadSettings(cb) {
  if (typeof window.getApiSettings === "function") {
    window
      .getApiSettings()
      .then(({ apiEndpoint, apiKey }) => cb({ apiEndpoint, apiKey }));
  }
}

function saveSettings() {
  let apiEndpoint =
    uiElements.apiEndpointInput.value.trim() || "http://localhost:8000";
  apiEndpoint = apiEndpoint.replace(/\/+$/, "");
  const apiKey = uiElements.apiKeyInput.value.trim();
  if (typeof window.saveApiSettings === "function") {
    window.saveApiSettings(apiEndpoint, apiKey).then(() => {
      uiElements.settingsSaved.hidden = false;
      setTimeout(() => {
        uiElements.settingsSaved.hidden = true;
      }, 1000);
    });
  }
}

function onRemoveFilter(e) {
  if (e.target.classList.contains("remove-btn")) {
    filterManager.remove(Number(e.target.dataset.idx));
  }
}

function onAddFilter() {
  const value = uiElements.filterInput.value.trim();
  if (value) {
    filterManager.add(value);
    uiElements.filterInput.value = "";
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
  sendMessageToContent({
    type: "APPLY_FILTERS",
    activeFilters: filterManager.getAll(),
    minMatch: getMinMatch(),
  });
}

function onMinMatchInput() {
  uiElements.minMatchValue.textContent = uiElements.minMatchInput.value;
  sendMessageToContent({
    type: "UPDATE_MIN_MATCH",
    minMatch: getMinMatch(),
  });
}

function getMinMatch() {
  return Math.max(0, parseInt(uiElements.minMatchInput.value, 10) || 0);
}

async function checkApiHealth() {
  let endpoint =
    uiElements.apiEndpointInput.value.trim() || "http://localhost:8000";
  endpoint = endpoint.replace(/\/+$/, "");
  const url = endpoint + "/health";
  uiElements.healthStatus.textContent = "Checking...";
  try {
    const resp = await fetch(url, { method: "GET" });
    uiElements.healthStatus.textContent = resp.ok
      ? "✅ Healthy"
      : "❌ Unhealthy";
  } catch {
    uiElements.healthStatus.textContent = "❌ Error";
  }
}

const filterManager = new FilterManager(renderFilters);

function initializeUI() {
  uiElements.minMatchInput.value = 0;
  uiElements.minMatchInput.max = 0;
  uiElements.minMatchInput.disabled = true;
  uiElements.minMatchValue.textContent = "0";
  filterManager.reset();
  updateButtonStates();
}

function checkPlatformAndEnableControls() {
  getActiveTab((tab) => {
    const url = tab?.url || "";
    const registry = window.platformRegistry;
    if (!registry) {
      showMessage("No registry.");
      setControlsEnabled(false);
      return;
    }
    const platform = registry.getCurrentPlatform(url);
    if (!platform) {
      showMessage("Not supported.");
      setControlsEnabled(false);
      return;
    }
    if (!registry.isCurrentPageSearchPage(url)) {
      showMessage("Only on search pages.");
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
    uiElements.apiEndpointInput.value = apiEndpoint || "http://localhost:8000";
    uiElements.apiKeyInput.value = apiKey || "";
  });
}

uiElements.filtersList.onclick = onRemoveFilter;
uiElements.addBtn.onclick = onAddFilter;
uiElements.resetBtn.onclick = onResetFilters;
uiElements.filterInput.addEventListener("keydown", onFilterInputKeydown);
uiElements.filtersForm.onsubmit = (e) => e.preventDefault();
uiElements.applyBtn.onclick = onApplyFilters;
uiElements.minMatchInput.oninput = onMinMatchInput;
uiElements.saveSettingsBtn.onclick = saveSettings;
uiElements.apiHealthBtn.onclick = checkApiHealth;

document.addEventListener("DOMContentLoaded", init);
