/**
 * SmartFilter - Popup UI
 * Simplified version with cleaner code organization
 */
(function () {
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
      },
    },
  };

  const DOM = {};

  const State = {
    currentSite: "",
    isSupported: false,
    filterCount: 0,
    results: null,

    async load() {
      const hostname = await API.getCurrentHostname();
      this.currentSite = hostname;

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
    },

    async saveFilters(filters) {
      this.filterCount = filters.length || 1;
      await chrome.storage.local.set({
        [`filters_${this.currentSite}`]: filters,
      });
    },

    async saveSettings(settings) {
      await chrome.storage.local.set({
        [`settings_${this.currentSite}`]: settings,
      });
    },

    async saveApiSettings(endpoint, key) {
      await chrome.storage.local.set({
        api_settings: { endpoint, key },
      });

      return API.notifySettingsChanged(endpoint, key);
    },
  };

  const API = {
    async getCurrentTab() {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      return tab;
    },

    async getCurrentHostname() {
      const tab = await this.getCurrentTab();
      if (!tab?.url) return "";
      try {
        return new URL(tab.url).hostname;
      } catch {
        return "";
      }
    },

    async sendMessageToTab(action, data = {}) {
      const tab = await this.getCurrentTab();
      try {
        return await chrome.tabs.sendMessage(tab.id, { action, ...data });
      } catch (error) {
        return { success: false, error: "Content script not ready" };
      }
    },

    async getVendorInfo() {
      return this.sendMessageToTab("getVendorInfo");
    },

    async getFilterState() {
      return this.sendMessageToTab("getFilterState");
    },

    async updateFilterThreshold(filterThreshold) {
      return this.sendMessageToTab("updateFilterThreshold", {
        filterThreshold,
      });
    },

    async applyFilters(filters, maxItems, filterThreshold) {
      return this.sendMessageToTab("applyFilters", {
        filters,
        maxItems,
        filterThreshold,
      });
    },

    async resetFilters() {
      return this.sendMessageToTab("resetFilters");
    },

    async notifySettingsChanged(endpoint, key) {
      try {
        return await chrome.runtime.sendMessage({
          action: "apiSettingsChanged",
          settings: { endpoint, key },
        });
      } catch (error) {
        return { success: false, error: "Background script error" };
      }
    },

    async loadApiSettings() {
      const stored = await chrome.storage.local.get(["api_settings"]);
      return (
        stored.api_settings || {
          endpoint: CONFIG.SETTINGS.API.DEFAULT_ENDPOINT,
          key: "",
        }
      );
    },
  };

  const UI = {
    async init() {
      this.cacheElements();
      this.setupEventListeners();
      await this.detectCurrentSite();

      if (this.isSupported) {
        await this.loadStoredState();
        await this.syncWithContentScript();
      }
    },

    cacheElements() {
      const elementIds = [
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
      ];

      elementIds.forEach((id) => (DOM[id] = document.getElementById(id)));
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
      DOM["toggle-advanced"].addEventListener("click", () =>
        this.toggleAdvancedPanel(),
      );
      DOM["save-api-settings"].addEventListener("click", () =>
        this.saveApiSettings(),
      );
      DOM["api-endpoint"].addEventListener("input", () => {
        this.validateInput(DOM["api-endpoint"], this.validateApiEndpoint);
      });
    },

    validateApiEndpoint(endpoint) {
      if (!endpoint) return true;
      try {
        const url = new URL(endpoint);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    },

    validateApiKey(key) {
      // Always allow empty keys - they're optional
      return true;
    },

    validateInput(inputEl, validationFn) {
      const isValid = validationFn(inputEl.value);
      inputEl.classList.toggle("invalid", !isValid);
      return isValid;
    },

    showApiSettingsStatus(message, isError = false, duration = 3000) {
      const statusEl = DOM["api-settings-status"];
      statusEl.textContent = message;
      statusEl.className = `settings-status ${isError ? "settings-error" : "settings-success"}`;
      statusEl.style.display = "block";

      clearTimeout(this._statusTimeoutId);
      this._statusTimeoutId = setTimeout(() => {
        statusEl.style.display = "none";
      }, duration);
    },

    async refreshApiSettings() {
      const settings = await API.loadApiSettings();
      DOM["api-endpoint"].value =
        settings.endpoint || CONFIG.SETTINGS.API.DEFAULT_ENDPOINT;
      DOM["api-key"].value = settings.key || "";
      return settings;
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
      const maxValue = State.filterCount;

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

      if (State.results) {
        const response = await API.updateFilterThreshold(
          parseInt(DOM["filter-threshold"].value),
        );

        if (response?.success) {
          State.results.matched = response.matched;
          this.updateResultsDisplay();
        }
      }
    },

    async detectCurrentSite() {
      const hostname = await API.getCurrentHostname();

      const isDomainSupported = CONFIG.SUPPORTED_DOMAINS.some((domain) =>
        hostname.includes(domain),
      );

      if (!isDomainSupported) {
        this.updateSiteStatus(false);
        return;
      }

      const response = await API.getVendorInfo();

      if (response?.success) {
        this.isSupported = true;
        this.updateSiteStatus(true, response.vendor);
      } else {
        this.isSupported = true;
        this.updateSiteStatus(true, {
          name: CONFIG.SUPPORTED_DOMAINS.find((domain) =>
            hostname.includes(domain),
          ),
        });
      }
    },

    updateSiteStatus(isCompatible, vendor = null) {
      document.body.classList.toggle("site-not-supported", !isCompatible);

      DOM["status-icon"].className =
        `status-icon ${isCompatible ? "compatible" : "not-compatible"}`;
      DOM["status-icon"].innerHTML =
        `<img src="../assets/images/${isCompatible ? "check-icon.svg" : "warning-icon.svg"}" alt="" class="status-svg">`;

      DOM["current-site"].textContent = isCompatible
        ? vendor?.name || "Compatible site"
        : "Not a supported site";

      DOM["site-message"].textContent = isCompatible
        ? "You can use filters on this site!"
        : "Navigate to a supported e-commerce site to use this extension.";

      DOM["filter-panel"].style.display = isCompatible ? "flex" : "none";
    },

    async loadStoredState() {
      if (!this.isSupported) return;

      const { filters, settings } = await State.load();

      DOM["max-items"].value = settings.maxItems;

      DOM["filter-list"].innerHTML = "";
      if (filters.length > 0) {
        filters.forEach((filter) => this.addFilterRow(filter));
      } else {
        this.addFilterRow("");
      }

      DOM["filter-threshold"].max = State.filterCount;
      DOM["filter-threshold"].value = Math.min(
        settings.filterThreshold || CONFIG.SETTINGS.FILTER_THRESHOLD.DEFAULT,
        State.filterCount,
      );

      this.updateThresholdDisplay();
      this.updateFilterControls();

      await this.refreshApiSettings();
    },

    async syncWithContentScript() {
      if (!this.isSupported) return;

      const response = await API.getFilterState();

      if (response?.success && response.isApplied) {
        State.results = {
          matched: response.matched,
          total: response.total,
          timestamp: Date.now(),
        };
        this.updateResultsDisplay();
      }
    },

    updateResultsDisplay() {
      const { results } = State;
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
    },

    addFilterRow(value = "") {
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
      removeBtn.onclick = () => this.removeFilterRow(row);

      input.addEventListener("input", () => {
        statusIndicator.className = `filter-status ${input.value.trim() ? "ready" : "empty"}`;
        statusIndicator.innerHTML = input.value.trim() ? "✓" : "?";
        this.updateFilterControls();
      });
      input.addEventListener("change", () => this.saveFilters());
      input.addEventListener("blur", () => this.saveFilters());

      // Add keyboard support for creating new filters
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          this.saveFilters();
          this.addFilterRow();
        }
      });

      row.appendChild(statusIndicator);
      row.appendChild(input);
      row.appendChild(removeBtn);
      filterList.appendChild(row);

      if (!value) {
        setTimeout(() => input.focus(), 50);
      }

      this.updateFilterControls();
      return row;
    },

    removeFilterRow(row) {
      const filterRows = document.querySelectorAll(".filter-row");

      if (filterRows.length <= 1) return;

      row.style.opacity = "0";
      row.style.transform = "translateY(10px)";

      setTimeout(() => {
        row.remove();
        this.saveFilters();

        if (document.querySelectorAll(".filter-row").length === 0) {
          this.addFilterRow("");
        }

        this.updateFilterControls();
      }, 300);
    },

    updateFilterControls() {
      const filterInputs = document.querySelectorAll(".filter-row input");

      const lastInput = filterInputs[filterInputs.length - 1];
      DOM["add-filter-btn"].disabled =
        lastInput && lastInput.value.trim() === "";

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

      State.filterCount = Math.max(1, validFilters);

      const threshold = DOM["filter-threshold"];
      threshold.max = State.filterCount;

      if (parseInt(threshold.value) > State.filterCount) {
        threshold.value = State.filterCount;
      }

      this.updateThresholdDisplay();
    },

    saveFilters() {
      const filters = Array.from(document.querySelectorAll(".filter-row input"))
        .map((input) => input.value.trim())
        .filter((text) => text !== "");

      State.saveFilters(filters);
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

      State.saveSettings(settings);
    },

    async applyFilters() {
      if (!this.isSupported) return;

      const filters = Array.from(document.querySelectorAll(".filter-row input"))
        .map((input) => input.value.trim())
        .filter((text) => text !== "");

      this.saveFilters();

      if (filters.length === 0) {
        alert("Please add at least one filter");
        return;
      }

      const applyBtn = DOM["apply-btn"];
      applyBtn.textContent = "Filtering...";
      applyBtn.disabled = true;
      applyBtn.classList.add("btn-loading");
      DOM["results-counter"].innerHTML =
        "<span class='loading'>Processing...</span>";

      const maxItems =
        parseInt(DOM["max-items"].value) || CONFIG.SETTINGS.MAX_ITEMS.DEFAULT;
      const filterThreshold =
        parseInt(DOM["filter-threshold"].value) ||
        CONFIG.SETTINGS.FILTER_THRESHOLD.DEFAULT;

      this.saveSettings();

      const response = await API.applyFilters(
        filters,
        maxItems,
        filterThreshold,
      );

      if (response?.success) {
        State.results = {
          matched: response.matched,
          total: response.total,
          timestamp: Date.now(),
          filters,
        };

        chrome.storage.local.set({
          [`lastApplied_${State.currentSite}`]: State.results,
        });

        this.updateResultsDisplay();
      } else {
        const errorMessage = response?.error || "Unknown error";
        DOM["results-counter"].innerHTML =
          `<span class="no-matches">Error: ${errorMessage}</span>`;
      }

      applyBtn.innerHTML = `<svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>Apply Filters`;
      applyBtn.disabled = false;
      applyBtn.classList.remove("btn-loading");
    },

    async resetFilters() {
      if (!this.isSupported) return;

      DOM["filter-list"].innerHTML = "";
      this.addFilterRow("");
      this.saveFilters();

      await API.resetFilters();

      State.results = null;
      chrome.storage.local.remove([`lastApplied_${State.currentSite}`]);
      DOM["results-counter"].innerHTML = "<span>Filters reset</span>";
    },

    toggleAdvancedPanel() {
      const advancedToggle = document.getElementById("toggle-advanced");
      const advancedContent = document.getElementById("advanced-panel");

      const isActive = advancedContent.classList.contains("active");

      if (isActive) {
        advancedToggle.classList.remove("active");
        advancedContent.classList.remove("active");
      } else {
        advancedToggle.classList.add("active");
        advancedContent.classList.add("active");
        this.refreshApiSettings();
      }
    },

    async saveApiSettings() {
      const endpoint =
        DOM["api-endpoint"].value.trim() ||
        CONFIG.SETTINGS.API.DEFAULT_ENDPOINT;
      // Allow empty key (it's optional)
      const key = DOM["api-key"].value.trim();

      if (!this.validateApiEndpoint(endpoint)) {
        this.showApiSettingsStatus("Invalid API endpoint format", true);
        return;
      }

      // We don't need to validate the key - empty is allowed

      const saveBtn = DOM["save-api-settings"];
      const originalText = saveBtn.textContent;
      saveBtn.textContent = "Saving...";
      saveBtn.disabled = true;

      try {
        const response = await State.saveApiSettings(endpoint, key);

        if (response?.success) {
          this.showApiSettingsStatus("Settings saved successfully!");
        } else {
          throw new Error(response?.error || "Failed to update settings");
        }

        await this.refreshApiSettings();
      } catch (error) {
        this.showApiSettingsStatus(
          `Error saving settings: ${error.message}`,
          true,
        );
        await this.refreshApiSettings();
      } finally {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
      }
    },
  };

  document.addEventListener("DOMContentLoaded", () => UI.init());
})();
