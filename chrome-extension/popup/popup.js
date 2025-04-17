/**
 * SmartFilter - Popup UI
 */
(function () {
  // Configuration
  const CONFIG = {
    SUPPORTED_DOMAINS: ["leboncoin.fr", "vinted.fr", "ebay.fr"],
    SETTINGS: {
      MAX_ITEMS: {
        DEFAULT: 5,
        MIN: 1,
        MAX: 10,
      },
      FILTER_THRESHOLD: {
        DEFAULT: 0,
        MIN: 0,
      },
      API: {
        DEFAULT_ENDPOINT: "http://localhost:8000",
        DEFAULT_KEY: "",
      },
    },
  };

  // DOM elements cache
  const DOM = {};

  const UI = {
    state: {
      currentSite: "",
      isSupported: false,
      filterCount: 0,
      results: null,
      advancedPanelVisible: false,
      apiSettingsStatus: {
        message: "",
        isError: false,
        timeoutId: null,
      },
    },

    async init() {
      this.cacheElements();
      this.setupEventListeners();
      await this.detectCurrentSite();
      await this.loadStoredState();
      await this.syncWithContentScript();
    },

    cacheElements() {
      const ids = [
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
        "advanced-panel",
        "toggle-advanced",
        "api-endpoint",
        "api-key",
        "save-api-settings",
        "api-settings-status",
      ];

      ids.forEach((id) => (DOM[id] = document.getElementById(id)));
    },

    setupEventListeners() {
      DOM["add-filter-btn"].addEventListener("click", () =>
        this.addFilterRow(),
      );
      DOM["max-items"].addEventListener("change", () => this.saveSettings());
      DOM["filter-threshold"].addEventListener("input", () =>
        this.updateThresholdDisplay(),
      );
      DOM["filter-threshold"].addEventListener("change", () =>
        this.handleThresholdChange(),
      );
      DOM["increase-max"].addEventListener("click", () =>
        this.changeMaxItems(1),
      );
      DOM["decrease-max"].addEventListener("click", () =>
        this.changeMaxItems(-1),
      );
      DOM["apply-btn"].addEventListener("click", () => this.applyFilters());
      DOM["reset-btn"].addEventListener("click", () => this.resetFilters());

      // Advanced settings
      DOM["toggle-advanced"].addEventListener("click", (e) => {
        e.preventDefault();
        this.toggleAdvancedPanel();
      });

      DOM["save-api-settings"].addEventListener("click", () => {
        this.saveApiSettings();
      });

      // Add input event listeners to validate API inputs in real-time
      DOM["api-endpoint"].addEventListener("input", () => {
        this.validateApiEndpoint(DOM["api-endpoint"].value);
      });
    },

    // Method to validate API endpoint format
    validateApiEndpoint(endpoint) {
      if (!endpoint) return true;

      try {
        const url = new URL(endpoint);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch (e) {
        return false;
      }
    },

    // Show API settings status message
    showApiSettingsStatus(message, isError = false, duration = 3000) {
      // Clear any existing timeout
      if (this.state.apiSettingsStatus.timeoutId) {
        clearTimeout(this.state.apiSettingsStatus.timeoutId);
      }

      const statusEl = DOM["api-settings-status"];
      statusEl.textContent = message;
      statusEl.className = `settings-status ${
        isError ? "settings-error" : "settings-success"
      }`;
      statusEl.style.display = "block";

      // Hide the message after duration
      this.state.apiSettingsStatus.timeoutId = setTimeout(() => {
        statusEl.style.display = "none";
      }, duration);

      this.state.apiSettingsStatus.message = message;
      this.state.apiSettingsStatus.isError = isError;
    },

    // Dedicated function to refresh API settings from storage
    async refreshApiSettings() {
      try {
        const stored = await chrome.storage.local.get(["api_settings"]);

        // Get API settings or set defaults
        const apiSettings = stored.api_settings || {
          endpoint: CONFIG.SETTINGS.API.DEFAULT_ENDPOINT,
          key: CONFIG.SETTINGS.API.DEFAULT_KEY,
        };

        // Update input fields
        DOM["api-endpoint"].value = apiSettings.endpoint;
        DOM["api-key"].value = apiSettings.key;

        return apiSettings;
      } catch (error) {
        console.error("Failed to load API settings:", error);
        // On error, revert to defaults
        DOM["api-endpoint"].value = CONFIG.SETTINGS.API.DEFAULT_ENDPOINT;
        DOM["api-key"].value = CONFIG.SETTINGS.API.DEFAULT_KEY;

        return {
          endpoint: CONFIG.SETTINGS.API.DEFAULT_ENDPOINT,
          key: CONFIG.SETTINGS.API.DEFAULT_KEY,
        };
      }
    },

    changeMaxItems(delta) {
      const input = DOM["max-items"];
      const newValue = Math.min(
        Math.max(CONFIG.SETTINGS.MAX_ITEMS.MIN, parseInt(input.value) + delta),
        CONFIG.SETTINGS.MAX_ITEMS.MAX,
      );
      input.value = newValue;
      this.saveSettings();
    },

    updateThresholdDisplay() {
      const value = parseInt(DOM["filter-threshold"].value);
      const maxValue = this.state.filterCount;

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
    },

    async handleThresholdChange() {
      this.saveSettings();

      if (this.state.results) {
        try {
          const tab = await this.getCurrentTab();
          const response = await chrome.tabs.sendMessage(tab.id, {
            action: "updateFilterThreshold",
            filterThreshold: parseInt(DOM["filter-threshold"].value),
          });

          if (response?.success) {
            this.state.results.matched = response.matched;
            this.updateResultsDisplay();
          }
        } catch (error) {
          console.error("Failed to update threshold in real-time:", error);
        }
      }
    },

    async getCurrentTab() {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      return tab;
    },

    async detectCurrentSite() {
      try {
        const currentTab = await this.getCurrentTab();
        if (!currentTab?.url) {
          this.updateSiteStatus(false);
          return;
        }

        const url = new URL(currentTab.url);
        this.state.currentSite = url.hostname;

        // Check if domain is supported
        const isDomainSupported = CONFIG.SUPPORTED_DOMAINS.some((domain) =>
          url.hostname.includes(domain),
        );

        if (!isDomainSupported) {
          this.updateSiteStatus(false);
          return;
        }

        // Try to get vendor info from content script
        try {
          const response = await chrome.tabs.sendMessage(currentTab.id, {
            action: "getVendorInfo",
          });

          if (response?.success) {
            this.state.isSupported = true;
            this.updateSiteStatus(true, response.vendor);
            return;
          }
        } catch (error) {
          console.log("Content script not ready");
        }

        // Fallback: mark as supported without detailed vendor info
        this.state.isSupported = true;
        this.updateSiteStatus(true, {
          name: CONFIG.SUPPORTED_DOMAINS.find((domain) =>
            url.hostname.includes(domain),
          ),
        });
      } catch (error) {
        this.updateSiteStatus(false);
      }
    },

    updateSiteStatus(isCompatible, vendor = null) {
      document.body.classList.toggle("site-not-supported", !isCompatible);

      DOM["status-icon"].className =
        `status-icon ${isCompatible ? "compatible" : "not-compatible"}`;
      DOM["status-icon"].innerHTML =
        `<img src="../images/${isCompatible ? "check-icon.svg" : "warning-icon.svg"}" alt="" class="status-svg">`;

      DOM["current-site"].textContent = isCompatible
        ? vendor?.name || "Compatible site"
        : "Not a supported site";

      DOM["site-message"].textContent = isCompatible
        ? "You can use filters on this site!"
        : "Navigate to a supported e-commerce site to use this extension.";

      DOM["filter-panel"].style.display = isCompatible ? "flex" : "none";
    },

    async loadStoredState() {
      if (!this.state.isSupported) return;

      const currentSite = this.state.currentSite;
      const stored = await chrome.storage.local.get([
        `filters_${currentSite}`,
        `settings_${currentSite}`,
        `lastApplied_${currentSite}`,
        "api_settings",
      ]);

      // Get filters or set defaults
      const filters = stored[`filters_${currentSite}`] || [];

      // Get settings or set defaults
      const settings = stored[`settings_${currentSite}`] || {
        maxItems: CONFIG.SETTINGS.MAX_ITEMS.DEFAULT,
        filterThreshold: CONFIG.SETTINGS.FILTER_THRESHOLD.DEFAULT,
      };

      // Load API settings using dedicated function
      await this.refreshApiSettings();

      // Update UI
      DOM["max-items"].value = settings.maxItems;

      // Populate filter list
      const filterList = DOM["filter-list"];
      filterList.innerHTML = "";

      if (filters.length > 0) {
        filters.forEach((filter) => this.addFilterRow(filter));
      } else {
        this.addFilterRow(""); // Add a single empty filter by default
      }

      // Update threshold settings
      this.state.filterCount = Math.max(1, filters.length);

      DOM["filter-threshold"].max = this.state.filterCount;
      DOM["filter-threshold"].value = Math.min(
        settings.filterThreshold || CONFIG.SETTINGS.FILTER_THRESHOLD.DEFAULT,
        this.state.filterCount,
      );

      this.updateThresholdDisplay();
      this.updateResultsDisplay();
      this.updateFilterControls();
    },

    async syncWithContentScript() {
      if (!this.state.isSupported) return;

      try {
        const tab = await this.getCurrentTab();
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: "getFilterState",
        });

        if (response?.success && response.isApplied) {
          this.state.results = {
            matched: response.matched,
            total: response.total,
            timestamp: Date.now(),
          };
          this.updateResultsDisplay();
        }
      } catch (error) {
        console.log("Could not sync with content script");
      }
    },

    updateResultsDisplay() {
      const { results } = this.state;

      if (!results) {
        DOM["results-counter"].innerHTML =
          "<span>No filters applied yet</span>";
        return;
      }

      const { matched, total } = results;
      DOM["results-counter"].innerHTML =
        `<span class="${matched === 0 ? "no-matches" : ""}">
        Matched <strong>${matched}</strong> of ${total} items
      </span>`;
    },

    addFilterRow(value = "") {
      const filterList = DOM["filter-list"];

      // Create row container
      const row = document.createElement("div");
      row.className = "filter-row";

      // Create status indicator
      const statusIndicator = document.createElement("div");
      statusIndicator.className = `filter-status ${
        value.trim() ? "ready" : "empty"
      }`;
      statusIndicator.innerHTML = value.trim() ? "✓" : "?";
      row.appendChild(statusIndicator);

      // Create input field
      const input = document.createElement("input");
      input.type = "text";
      input.value = value;
      input.placeholder = value ? "" : "Enter filter criteria";

      // Add input event listeners
      input.addEventListener("change", () => this.saveFilters());
      input.addEventListener("input", () => {
        statusIndicator.className = `filter-status ${
          input.value.trim() ? "ready" : "empty"
        }`;
        statusIndicator.innerHTML = input.value.trim() ? "✓" : "?";
        this.updateFilterControls();
      });
      input.addEventListener("blur", () => this.saveFilters());

      // Create remove button
      const removeBtn = document.createElement("button");
      removeBtn.innerHTML = "×";
      removeBtn.title = "Remove filter";
      removeBtn.onclick = () => this.removeFilterRow(row);

      // Assemble and add row
      row.appendChild(input);
      row.appendChild(removeBtn);
      filterList.appendChild(row);

      // Focus empty input fields
      if (!value) {
        setTimeout(() => input.focus(), 50);
      }

      // Update UI controls
      this.updateFilterControls();

      return row;
    },

    removeFilterRow(row) {
      const filterRows = document.querySelectorAll(".filter-row");

      // Don't remove the last row
      if (filterRows.length <= 1) {
        return;
      }

      // Animate removal
      row.style.opacity = "0";
      row.style.transform = "translateY(10px)";

      setTimeout(() => {
        row.remove();
        this.saveFilters();

        // Add an empty row if all were removed
        if (document.querySelectorAll(".filter-row").length === 0) {
          this.addFilterRow("");
        }

        this.updateFilterControls();
      }, 300);
    },

    updateFilterControls() {
      // Update add button state
      const filterInputs = document.querySelectorAll(".filter-row input");
      const lastInput = filterInputs[filterInputs.length - 1];
      DOM["add-filter-btn"].disabled =
        lastInput && lastInput.value.trim() === "";

      // Update remove buttons state
      const removeButtons = document.querySelectorAll(".filter-row button");
      const disableRemove = filterInputs.length <= 1;

      removeButtons.forEach((btn) => {
        btn.disabled = disableRemove;
        btn.title = disableRemove
          ? "Cannot remove the last filter"
          : "Remove filter";
      });

      // Count only valid (non-empty) filters for the threshold slider
      const validFilters = Array.from(filterInputs).filter(
        (input) => input.value.trim() !== "",
      ).length;

      // Update threshold slider max value based on valid filters only
      this.state.filterCount = Math.max(1, validFilters);

      const threshold = DOM["filter-threshold"];
      threshold.max = this.state.filterCount;

      // Ensure the current value doesn't exceed the new maximum
      if (parseInt(threshold.value) > this.state.filterCount) {
        threshold.value = this.state.filterCount;
      }

      this.updateThresholdDisplay();
    },

    saveFilters() {
      const filters = Array.from(document.querySelectorAll(".filter-row input"))
        .map((input) => input.value.trim())
        .filter((text) => text !== "");

      chrome.storage.local.set({
        [`filters_${this.state.currentSite}`]: filters,
      });

      // Update controls after saving to reflect the current valid filter count
      this.updateFilterControls();
    },

    saveSettings() {
      const settings = {
        maxItems:
          parseInt(DOM["max-items"].value) || CONFIG.SETTINGS.MAX_ITEMS.DEFAULT,
        filterThreshold:
          parseInt(DOM["filter-threshold"].value) ||
          CONFIG.SETTINGS.FILTER_THRESHOLD.DEFAULT,
      };

      chrome.storage.local.set({
        [`settings_${this.state.currentSite}`]: settings,
      });
    },

    async applyFilters() {
      if (!this.state.isSupported) return;

      // Get filters
      const filters = Array.from(document.querySelectorAll(".filter-row input"))
        .map((input) => input.value.trim())
        .filter((text) => text !== "");

      this.saveFilters();

      if (filters.length === 0) {
        alert("Please add at least one filter");
        return;
      }

      // Update UI to loading state
      const applyBtn = DOM["apply-btn"];
      applyBtn.textContent = "Filtering...";
      applyBtn.disabled = true;
      applyBtn.classList.add("btn-loading");
      DOM["results-counter"].innerHTML =
        "<span class='loading'>Processing...</span>";

      // Get settings
      const maxItems =
        parseInt(DOM["max-items"].value) || CONFIG.SETTINGS.MAX_ITEMS.DEFAULT;
      const filterThreshold =
        parseInt(DOM["filter-threshold"].value) ||
        CONFIG.SETTINGS.FILTER_THRESHOLD.DEFAULT;

      this.saveSettings();

      // Send filter request to content script
      try {
        const tab = await this.getCurrentTab();
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: "applyFilters",
          filters,
          maxItems,
          filterThreshold,
        });

        if (response?.success) {
          this.state.results = {
            matched: response.matched,
            total: response.total,
            timestamp: Date.now(),
            filters,
          };

          chrome.storage.local.set({
            [`lastApplied_${this.state.currentSite}`]: this.state.results,
          });

          this.updateResultsDisplay();
        } else {
          const errorMessage = response?.error || "Unknown error";
          DOM["results-counter"].innerHTML =
            `<span class="no-matches">Error: ${errorMessage}</span>`;
        }
      } catch (error) {
        DOM["results-counter"].innerHTML =
          `<span class="no-matches">Error: Content script not available</span>`;
      }

      // Reset button state
      applyBtn.innerHTML = `<svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>Apply Filters`;
      applyBtn.disabled = false;
      applyBtn.classList.remove("btn-loading");
    },

    async resetFilters() {
      if (!this.state.isSupported) return;

      try {
        // Clear filter list and add a single empty filter
        DOM["filter-list"].innerHTML = "";
        this.addFilterRow(""); // Add a single empty filter

        this.saveFilters();
        this.updateFilterControls();

        // Reset content script filtering
        const tab = await this.getCurrentTab();
        await chrome.tabs.sendMessage(tab.id, { action: "resetFilters" });

        // Clear results
        this.state.results = null;
        chrome.storage.local.remove([`lastApplied_${this.state.currentSite}`]);
        DOM["results-counter"].innerHTML = "<span>Filters reset</span>";
      } catch (error) {
        console.error("Failed to reset filters:", error);
      }
    },

    toggleAdvancedPanel() {
      // Always refresh API settings when opening panel to ensure latest values
      if (!this.state.advancedPanelVisible) {
        this.refreshApiSettings();
      }

      this.state.advancedPanelVisible = !this.state.advancedPanelVisible;
      DOM["advanced-panel"].style.display = this.state.advancedPanelVisible
        ? "flex"
        : "none";

      // Toggle the active class for styling
      DOM["toggle-advanced"].classList.toggle(
        "active",
        this.state.advancedPanelVisible,
      );
    },

    async saveApiSettings() {
      const endpoint =
        DOM["api-endpoint"].value.trim() || CONFIG.SETTINGS.API.DEFAULT_ENDPOINT;
      const key = DOM["api-key"].value.trim();

      // Validate endpoint format
      if (!this.validateApiEndpoint(endpoint)) {
        this.showApiSettingsStatus("Invalid API endpoint format", true);
        return;
      }

      const saveBtn = DOM["save-api-settings"];
      const originalText = saveBtn.textContent;
      saveBtn.textContent = "Saving...";
      saveBtn.disabled = true;

      try {
        // Save to storage
        await chrome.storage.local.set({
          api_settings: { endpoint, key },
        });

        // Notify background script about the change
        const response = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(
            { action: "apiSettingsChanged", settings: { endpoint, key } },
            (response) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(response);
              }
            },
          );
        });

        if (response?.success) {
          this.showApiSettingsStatus("Settings saved successfully!");
        } else {
          throw new Error("Failed to update settings in background script");
        }

        // Refresh API settings to ensure UI is in sync with storage
        await this.refreshApiSettings();
      } catch (error) {
        console.error("Failed to save API settings:", error);
        this.showApiSettingsStatus("Error saving settings: " + error.message, true);

        // Refresh API settings to revert any partial changes
        await this.refreshApiSettings();
      } finally {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
      }
    },
  };

  // Initialize when DOM is loaded
  document.addEventListener("DOMContentLoaded", () => UI.init());
})();
