(function () {
  const CONFIG = {
    SUPPORTED_DOMAINS: ["leboncoin.fr", "vinted.fr", "ebay.fr"],
    SETTINGS: {
      MAX_ITEMS: { DEFAULT: 5, MIN: 1, MAX: 10 },
      FILTER_THRESHOLD: { DEFAULT: 0, MIN: 0 },
      API: { DEFAULT_ENDPOINT: "http://localhost:8000" },
    },
  };

  const DOM = {};
  let CURRENT_STATE = {
    currentSite: "",
    isSupported: false,
    filterCount: 0,
    results: null,
  };

  // Core functions
  async function getCurrentTab() {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    return tab;
  }

  async function sendMessageToTab(action, data = {}) {
    const tab = await getCurrentTab();
    try {
      return await chrome.tabs.sendMessage(tab.id, { action, ...data });
    } catch {
      return { success: false, error: "Content script not ready" };
    }
  }

  async function getCurrentHostname() {
    const tab = await getCurrentTab();
    if (!tab?.url) return "";
    try {
      return new URL(tab.url).hostname;
    } catch {
      return "";
    }
  }

  // Storage operations
  async function loadState() {
    const hostname = await getCurrentHostname();
    CURRENT_STATE.currentSite = hostname;

    const stored = await chrome.storage.local.get([
      `filters_${hostname}`,
      `settings_${hostname}`,
      `lastApplied_${hostname}`,
    ]);

    return {
      filters: stored[`filters_${hostname}`] || [],
      settings: stored[`settings_${hostname}`] || {
        maxItems: CONFIG.SETTINGS.MAX_ITEMS.DEFAULT,
        filterThreshold: CONFIG.SETTINGS.FILTER_THRESHOLD.DEFAULT,
      },
    };
  }

  async function saveFilters() {
    const filters = Array.from(document.querySelectorAll(".filter-row input"))
      .map((input) => input.value.trim())
      .filter((text) => text !== "");

    CURRENT_STATE.filterCount = filters.length || 1;

    await chrome.storage.local.set({
      [`filters_${CURRENT_STATE.currentSite}`]: filters,
    });

    return filters;
  }

  async function saveSettings() {
    const settings = {
      maxItems:
        parseInt(DOM["max-items"].value) || CONFIG.SETTINGS.MAX_ITEMS.DEFAULT,
      filterThreshold:
        parseInt(DOM["filter-threshold"].value) ||
        CONFIG.SETTINGS.FILTER_THRESHOLD.DEFAULT,
    };

    await chrome.storage.local.set({
      [`settings_${CURRENT_STATE.currentSite}`]: settings,
    });

    return settings;
  }

  async function saveApiSettings() {
    const endpoint =
      DOM["api-endpoint"].value.trim() || CONFIG.SETTINGS.API.DEFAULT_ENDPOINT;
    const key = DOM["api-key"].value.trim();

    if (!validateUrl(endpoint)) {
      showApiSettingsStatus("Invalid API endpoint format", true);
      return false;
    }

    showButton(DOM["save-api-settings"], true, "Saving...");

    try {
      const response = await chrome.runtime.sendMessage({
        action: "apiSettingsChanged",
        settings: { endpoint, key },
      });

      if (response?.success) {
        await chrome.storage.local.set({ api_settings: { endpoint, key } });
        showApiSettingsStatus("Settings saved successfully!");
        return true;
      } else {
        throw new Error(response?.error || "Failed to update settings");
      }
    } catch (error) {
      showApiSettingsStatus(`Error: ${error.message}`, true);
      return false;
    } finally {
      showButton(DOM["save-api-settings"], false);
    }
  }

  async function loadApiSettings() {
    const stored = await chrome.storage.local.get(["api_settings"]);
    return (
      stored.api_settings || {
        endpoint: CONFIG.SETTINGS.API.DEFAULT_ENDPOINT,
        key: "",
      }
    );
  }

  // UI Operations
  function updateThresholdDisplay() {
    const value = parseInt(DOM["filter-threshold"].value);
    const maxValue = CURRENT_STATE.filterCount;

    let text;
    if (value === CONFIG.SETTINGS.FILTER_THRESHOLD.MIN) {
      text = "Show all products";
    } else if (value === maxValue) {
      text = maxValue === 1 ? "Criterion required" : "All criteria required";
    } else if (value === 1) {
      text = "At least 1 criterion";
    } else {
      text = `At least ${value} criteria`;
    }

    DOM["threshold-value"].textContent = text;
  }

  function updateSiteStatus(isCompatible, platform = null) {
    const { name = "Compatible site" } = platform || {};
    const status = isCompatible ? "compatible" : "not-compatible";
    const icon = isCompatible ? "check-icon.svg" : "warning-icon.svg";

    document.body.classList.toggle("site-not-supported", !isCompatible);

    DOM["status-icon"].className = `status-icon ${status}`;
    DOM["status-icon"].innerHTML =
      `<img src="../assets/images/${icon}" alt="" class="status-svg">`;

    DOM["current-site"].textContent = isCompatible
      ? name
      : "Not a supported site";
    DOM["site-message"].textContent = isCompatible
      ? "You can use filters on this site!"
      : "Navigate to a supported e-commerce site to use this extension.";

    DOM["filter-panel"].style.display = isCompatible ? "flex" : "none";
  }

  function addFilterRow(value = "") {
    const filterList = DOM["filter-list"];

    const row = document.createElement("div");
    row.className = "filter-row";

    const statusIndicator = document.createElement("div");
    statusIndicator.className = `filter-status ${value.trim() ? "ready" : "empty"}`;
    statusIndicator.innerHTML = value.trim() ? "✓" : "?";

    const input = document.createElement("input");
    input.type = "text";
    input.value = value;
    input.placeholder = value ? "" : "Enter filter criteria";

    const removeBtn = document.createElement("button");
    removeBtn.innerHTML = "×";
    removeBtn.title = "Remove filter";
    removeBtn.onclick = () => removeFilterRow(row);

    input.addEventListener("input", () => {
      statusIndicator.className = `filter-status ${input.value.trim() ? "ready" : "empty"}`;
      statusIndicator.innerHTML = input.value.trim() ? "✓" : "?";
      updateFilterControls();
    });

    input.addEventListener("change", saveFilters);
    input.addEventListener("blur", saveFilters);

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        saveFilters();
        addFilterRow();
      }
    });

    row.appendChild(statusIndicator);
    row.appendChild(input);
    row.appendChild(removeBtn);
    filterList.appendChild(row);

    if (!value) {
      setTimeout(() => input.focus(), 50);
    }

    updateFilterControls();
    return row;
  }

  function removeFilterRow(row) {
    const filterRows = document.querySelectorAll(".filter-row");
    if (filterRows.length <= 1) return;

    row.style.opacity = "0";
    row.style.transform = "translateY(10px)";

    setTimeout(() => {
      row.remove();
      saveFilters();

      if (document.querySelectorAll(".filter-row").length === 0) {
        addFilterRow("");
      }

      updateFilterControls();
    }, 300);
  }

  function updateFilterControls() {
    const filterInputs = document.querySelectorAll(".filter-row input");

    const lastInput = filterInputs[filterInputs.length - 1];
    DOM["add-filter-btn"].disabled = lastInput && lastInput.value.trim() === "";

    const disableRemove = filterInputs.length <= 1;
    document.querySelectorAll(".filter-row button").forEach((btn) => {
      btn.disabled = disableRemove;
      btn.title = disableRemove
        ? "Cannot remove the last filter"
        : "Remove filter";
    });

    const validFilters = Array.from(filterInputs).filter(
      (input) => input.value.trim() !== "",
    ).length;

    CURRENT_STATE.filterCount = Math.max(1, validFilters);

    const threshold = DOM["filter-threshold"];
    threshold.max = CURRENT_STATE.filterCount;

    if (parseInt(threshold.value) > CURRENT_STATE.filterCount) {
      threshold.value = CURRENT_STATE.filterCount;
    }

    updateThresholdDisplay();
  }

  function updateResultsDisplay() {
    const { results } = CURRENT_STATE;
    const resultsCounter = DOM["results-counter"];

    if (!results) {
      resultsCounter.innerHTML = `
        <div class="results-indicator">
          <div class="status-dot"></div>
          <span class="results-text">No filters applied yet</span>
        </div>
        <div class="results-details"></div>
      `;
      return;
    }

    const { matched, total } = results;
    const statusClass = matched === 0 ? "no-matches" : "success";

    resultsCounter.innerHTML = `
      <div class="results-indicator ${statusClass}">
        <div class="status-dot"></div>
        <span class="results-text">
          Matched <strong>${matched}</strong> of ${total} items
        </span>
      </div>
      <div class="results-details"></div>
    `;
  }

  function showApiSettingsStatus(message, isError = false, duration = 3000) {
    const statusEl = DOM["api-settings-status"];
    statusEl.textContent = message;
    statusEl.className = `settings-status ${isError ? "settings-error" : "settings-success"}`;
    statusEl.style.display = "block";

    clearTimeout(statusEl._timeoutId);
    statusEl._timeoutId = setTimeout(() => {
      statusEl.style.display = "none";
    }, duration);
  }

  function showButton(button, loading = false, loadingText = null) {
    if (!button._originalText) button._originalText = button.textContent;

    button.disabled = loading;
    button.classList.toggle("btn-loading", loading);
    button.textContent = loading
      ? loadingText || "Loading..."
      : button._originalText;
  }

  // Utility functions
  function validateUrl(str) {
    if (!str) return true;
    try {
      const url = new URL(str);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }

  function changeMaxItems(delta) {
    const input = DOM["max-items"];
    const newValue = Math.min(
      Math.max(CONFIG.SETTINGS.MAX_ITEMS.MIN, parseInt(input.value) + delta),
      CONFIG.SETTINGS.MAX_ITEMS.MAX,
    );
    input.value = newValue;
    saveSettings();
  }

  function toggleAdvancedPanel() {
    const isActive = DOM["advanced-panel"].classList.contains("active");

    DOM["toggle-advanced"].classList.toggle("active", !isActive);
    DOM["advanced-panel"].classList.toggle("active", !isActive);

    if (!isActive) {
      refreshApiSettings();
    }
  }

  // Main actions
  async function detectCurrentSite() {
    const hostname = await getCurrentHostname();
    const isDomainSupported = CONFIG.SUPPORTED_DOMAINS.some((domain) =>
      hostname.includes(domain),
    );

    if (!isDomainSupported) {
      updateSiteStatus(false);
      return false;
    }

    const response = await sendMessageToTab("getPlatformInfo");

    if (response?.success) {
      CURRENT_STATE.isSupported = true;
      updateSiteStatus(true, response.platform);
      return true;
    } else {
      CURRENT_STATE.isSupported = true;
      updateSiteStatus(true, {
        name: CONFIG.SUPPORTED_DOMAINS.find((domain) =>
          hostname.includes(domain),
        ),
      });
      return true;
    }
  }

  async function applyFilters() {
    if (!CURRENT_STATE.isSupported) return;

    const filters = await saveFilters();
    if (filters.length === 0) {
      alert("Please add at least one filter");
      return;
    }

    showButton(DOM["apply-btn"], true, "Filtering...");
    DOM["results-counter"].innerHTML =
      "<span class='loading'>Processing...</span>";

    const settings = await saveSettings();
    const response = await sendMessageToTab("applyFilters", {
      filters,
      maxItems: settings.maxItems,
      filterThreshold: settings.filterThreshold,
    });

    if (response?.success) {
      CURRENT_STATE.results = {
        matched: response.matched,
        total: response.total,
        timestamp: Date.now(),
        filters,
      };

      chrome.storage.local.set({
        [`lastApplied_${CURRENT_STATE.currentSite}`]: CURRENT_STATE.results,
      });
    } else {
      const errorMessage = response?.error || "Unknown error";
      DOM["results-counter"].innerHTML =
        `<span class="no-matches">Error: ${errorMessage}</span>`;
    }

    updateResultsDisplay();
    showButton(DOM["apply-btn"], false);
  }

  async function resetFilters() {
    if (!CURRENT_STATE.isSupported) return;

    DOM["filter-list"].innerHTML = "";
    addFilterRow("");
    await saveFilters();
    await sendMessageToTab("resetFilters");

    CURRENT_STATE.results = null;
    chrome.storage.local.remove([`lastApplied_${CURRENT_STATE.currentSite}`]);
    DOM["results-counter"].innerHTML = "<span>Filters reset</span>";
  }

  async function handleThresholdChange() {
    await saveSettings();

    if (CURRENT_STATE.results) {
      const response = await sendMessageToTab("updateFilterThreshold", {
        filterThreshold: parseInt(DOM["filter-threshold"].value),
      });

      if (response?.success) {
        CURRENT_STATE.results.matched = response.matched;
        updateResultsDisplay();
      }
    }
  }

  async function refreshApiSettings() {
    const settings = await loadApiSettings();
    DOM["api-endpoint"].value =
      settings.endpoint || CONFIG.SETTINGS.API.DEFAULT_ENDPOINT;
    DOM["api-key"].value = settings.key || "";
    return settings;
  }

  async function loadStoredState() {
    if (!CURRENT_STATE.isSupported) return;

    const { filters, settings } = await loadState();

    DOM["max-items"].value = settings.maxItems;
    DOM["filter-list"].innerHTML = "";

    if (filters.length > 0) {
      filters.forEach((filter) => addFilterRow(filter));
    } else {
      addFilterRow("");
    }

    DOM["filter-threshold"].max = CURRENT_STATE.filterCount;
    DOM["filter-threshold"].value = Math.min(
      settings.filterThreshold || CONFIG.SETTINGS.FILTER_THRESHOLD.DEFAULT,
      CURRENT_STATE.filterCount,
    );

    updateThresholdDisplay();
    updateFilterControls();
    await refreshApiSettings();
  }

  async function syncWithContentScript() {
    if (!CURRENT_STATE.isSupported) return;

    const response = await sendMessageToTab("getFilterState");

    if (response?.success && response.isApplied) {
      CURRENT_STATE.results = {
        matched: response.matched,
        total: response.total,
        timestamp: Date.now(),
      };
      updateResultsDisplay();
    }
  }

  // Initialize
  async function init() {
    cacheElements();
    setupEventListeners();

    const siteSupported = await detectCurrentSite();

    if (siteSupported) {
      await loadStoredState();
      await syncWithContentScript();
    }
  }

  function cacheElements() {
    [
      "status-icon",
      "current-site",
      "site-message",
      "filter-panel",
      "filter-list",
      "max-items",
      "filter-threshold",
      "threshold-value",
      "add-filter-btn",
      "apply-btn",
      "reset-btn",
      "results-counter",
      "increase-max",
      "decrease-max",
      "toggle-advanced",
      "advanced-panel",
      "api-endpoint",
      "api-key",
      "save-api-settings",
      "api-settings-status",
    ].forEach((id) => (DOM[id] = document.getElementById(id)));
  }

  function setupEventListeners() {
    DOM["add-filter-btn"].addEventListener("click", () => addFilterRow());
    DOM["max-items"].addEventListener("click", () => saveSettings());
    DOM["filter-threshold"].addEventListener("change", handleThresholdChange);
    DOM["filter-threshold"].addEventListener("input", updateThresholdDisplay);
    DOM["increase-max"].addEventListener("click", () => changeMaxItems(1));
    DOM["decrease-max"].addEventListener("click", () => changeMaxItems(-1));
    DOM["apply-btn"].addEventListener("click", applyFilters);
    DOM["reset-btn"].addEventListener("click", resetFilters);
    DOM["toggle-advanced"].addEventListener("click", toggleAdvancedPanel);
    DOM["save-api-settings"].addEventListener("click", saveApiSettings);

    DOM["api-endpoint"].addEventListener("blur", () =>
      validateUrl(DOM["api-endpoint"].value),
    );
  }

  document.addEventListener("DOMContentLoaded", init);
})();
