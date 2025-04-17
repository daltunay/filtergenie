/**
 * SmartFilter - Popup UI
 */
(function () {
  // Configuration as a single constant object
  const CONFIG = {
    SUPPORTED_DOMAINS: ["leboncoin.fr", "vinted.fr", "ebay.fr"],
    // Use window.DEFAULT_FILTERS instead of defining here
    SETTINGS: {
      MAX_ITEMS: {
        DEFAULT: 5,
        MIN: 1,
        MAX: 10,
      },
      FILTER_THRESHOLD: {
        DEFAULT: 0, // Set to 0 to show all products by default
        MIN: 0,
      },
    },
  };

  // Cache DOM selectors for performance
  const DOM = {};

  // Use a more functional approach with separate modules
  const UI = {
    state: {
      currentSite: "",
      isSupported: false,
      filterCount: 0,
      results: null,
    },

    /**
     * Initialize the UI
     */
    async init() {
      this.cacheElements();
      this.setupEventListeners();
      await this.detectCurrentSite();
      await this.loadStoredState();
      await this.syncWithContentScript();
    },

    /**
     * Cache DOM elements - improved selector caching
     */
    cacheElements() {
      // Using a single function to reduce repetition
      const getElement = (id) => document.getElementById(id);

      DOM.statusIcon = getElement("status-icon");
      DOM.currentSite = getElement("current-site");
      DOM.siteMessage = getElement("site-message");
      DOM.filterPanel = getElement("filter-panel");
      DOM.filterList = getElement("filter-list");
      DOM.maxItems = getElement("max-items");
      DOM.filterThreshold = getElement("filter-threshold");
      DOM.thresholdValue = getElement("threshold-value");
      DOM.addFilterBtn = getElement("add-filter-btn");
      DOM.applyBtn = getElement("apply-btn");
      DOM.resetBtn = getElement("reset-btn");
      DOM.resultsCounter = getElement("results-counter");
      DOM.increaseMax = getElement("increase-max");
      DOM.decreaseMax = getElement("decrease-max");

      // Backward compatibility
      DOM.hideNonMatching = { checked: false };
    },

    /**
     * Set up event listeners
     */
    setupEventListeners() {
      // Filter management
      DOM.addFilterBtn.addEventListener("click", () => this.addFilterRow());

      // Settings
      DOM.maxItems.addEventListener("change", () => this.saveSettings());
      DOM.filterThreshold.addEventListener("input", () =>
        this.updateThresholdDisplay(),
      );
      DOM.filterThreshold.addEventListener("change", () =>
        this.handleThresholdChange(),
      );

      // Number input controls
      DOM.increaseMax.addEventListener("click", () => this.changeMaxItems(1));
      DOM.decreaseMax.addEventListener("click", () => this.changeMaxItems(-1));

      // Action buttons
      DOM.applyBtn.addEventListener("click", () => this.applyFilters());
      DOM.resetBtn.addEventListener("click", () => this.resetFilters());
    },

    /**
     * Change max items value
     */
    changeMaxItems(delta) {
      const input = DOM.maxItems;
      const newValue = Math.min(
        Math.max(CONFIG.SETTINGS.MAX_ITEMS.MIN, parseInt(input.value) + delta),
        CONFIG.SETTINGS.MAX_ITEMS.MAX,
      );
      input.value = newValue;
      this.saveSettings();
    },

    /**
     * Update threshold display text
     */
    updateThresholdDisplay() {
      if (!DOM.thresholdValue) return;

      const value = parseInt(DOM.filterThreshold.value);
      const maxValue = this.state.filterCount;

      let text;
      if (value === CONFIG.SETTINGS.FILTER_THRESHOLD.MIN) {
        text = "Show all products";
      } else if (value === maxValue) {
        text = maxValue === 1 ? "Criterion required" : "All criteria required"; // Single criterion wording
      } else if (value === 1) {
        text = "At least 1 criterion";
      } else {
        text = `At least ${value} criteria`;
      }

      DOM.thresholdValue.textContent = text;
    },

    /**
     * Handle threshold change
     */
    async handleThresholdChange() {
      this.saveSettings();

      if (this.state.results) {
        try {
          const tab = await this.getCurrentTab();
          const response = await chrome.tabs.sendMessage(tab.id, {
            action: "updateFilterThreshold",
            filterThreshold: parseInt(DOM.filterThreshold.value),
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

    /**
     * Get the current tab
     */
    async getCurrentTab() {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      return tabs[0];
    },

    /**
     * Detect the current site
     */
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

    /**
     * Update site status in UI - simplified
     */
    updateSiteStatus(isCompatible, vendor = null) {
      const { statusIcon, currentSite, siteMessage, filterPanel } = DOM;

      // Toggle site-not-supported class
      document.body.classList.toggle("site-not-supported", !isCompatible);

      // Update status icon
      statusIcon.className = `status-icon ${
        isCompatible ? "compatible" : "not-compatible"
      }`;
      statusIcon.innerHTML = `<img src="../images/${
        isCompatible ? "check-icon.svg" : "warning-icon.svg"
      }" alt="" class="status-svg">`;

      // Update text content
      currentSite.textContent = isCompatible
        ? vendor?.name || "Compatible site"
        : "Not a supported site";
      siteMessage.textContent = isCompatible
        ? "You can use filters on this site!"
        : "Navigate to a supported e-commerce site to use this extension.";

      // Show/hide filter panel
      filterPanel.style.display = isCompatible ? "flex" : "none";
    },

    /**
     * Load saved state from storage
     */
    async loadStoredState() {
      if (!this.state.isSupported) return;

      const currentSite = this.state.currentSite;
      const stored = await chrome.storage.local.get([
        `filters_${currentSite}`,
        `settings_${currentSite}`,
        `lastApplied_${currentSite}`,
      ]);

      // Get filters or set defaults
      const filters = stored[`filters_${currentSite}`] || [];

      // Get settings or set defaults
      const settings = stored[`settings_${currentSite}`] || {
        maxItems: CONFIG.SETTINGS.MAX_ITEMS.DEFAULT,
        filterThreshold: CONFIG.SETTINGS.FILTER_THRESHOLD.DEFAULT,
      };

      // Get results or set defaults
      this.state.results = stored[`lastApplied_${currentSite}`] || null;

      // Update UI
      DOM.maxItems.value = settings.maxItems;

      // Handle backward compatibility
      if (settings.hideNonMatching !== undefined) {
        DOM.hideNonMatching.checked = settings.hideNonMatching;
        settings.filterThreshold = settings.hideNonMatching
          ? filters.length || CONFIG.SETTINGS.FILTER_THRESHOLD.DEFAULT
          : settings.filterThreshold || CONFIG.SETTINGS.FILTER_THRESHOLD.DEFAULT;
      }

      // Populate filter list
      const filterList = DOM.filterList;
      filterList.innerHTML = "";

      if (filters.length > 0) {
        filters.forEach((filter) => this.addFilterRow(filter));
      } else {
        this.addFilterRow("");  // Add a single empty filter by default
      }

      // Update threshold settings
      this.state.filterCount = Math.max(1, filters.length);
      if (DOM.filterThreshold) {
        DOM.filterThreshold.max = this.state.filterCount;
        DOM.filterThreshold.value = Math.min(
          settings.filterThreshold || CONFIG.SETTINGS.FILTER_THRESHOLD.DEFAULT,
          this.state.filterCount,
        );
        this.updateThresholdDisplay();
      }

      this.updateResultsDisplay();
      this.updateFilterControls();
    },

    /**
     * Sync with content script
     */
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

    /**
     * Update results counter display
     */
    updateResultsDisplay() {
      const { resultsCounter } = DOM;
      const { results } = this.state;

      if (!results) {
        resultsCounter.innerHTML = "<span>No filters applied yet</span>";
        return;
      }

      const { matched, total } = results;
      resultsCounter.innerHTML = `<span class="${
        matched === 0 ? "no-matches" : ""
      }">
        Matched <strong>${matched}</strong> of ${total} items
      </span>`;
    },

    /**
     * Add a filter row
     */
    addFilterRow(value = "") {
      const filterList = DOM.filterList;

      // Create row container
      const row = document.createElement("div");
      row.className = "filter-row";
      
      // Create status indicator
      const statusIndicator = document.createElement("div");
      statusIndicator.className = `filter-status ${value.trim() ? 'ready' : 'empty'}`;
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
        // Update status indicator when input changes
        statusIndicator.className = `filter-status ${input.value.trim() ? 'ready' : 'empty'}`;
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

    /**
     * Remove a filter row
     */
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

    /**
     * Update filter button states
     */
    updateFilterControls() {
      // Update add button state
      const filterInputs = document.querySelectorAll(".filter-row input");
      const lastInput = filterInputs[filterInputs.length - 1];
      DOM.addFilterBtn.disabled = lastInput && lastInput.value.trim() === "";

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
      const validFilters = Array.from(filterInputs)
        .filter(input => input.value.trim() !== "")
        .length;
      
      // Update threshold slider max value based on valid filters only
      this.state.filterCount = Math.max(1, validFilters);
      if (DOM.filterThreshold) {
        DOM.filterThreshold.max = this.state.filterCount;
        // Ensure the current value doesn't exceed the new maximum
        if (parseInt(DOM.filterThreshold.value) > this.state.filterCount) {
          DOM.filterThreshold.value = this.state.filterCount;
        }
        this.updateThresholdDisplay();
      }
    },

    /**
     * Save filters to storage
     */
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

    /**
     * Save settings to storage
     */
    saveSettings() {
      const settings = {
        maxItems:
          parseInt(DOM.maxItems.value) || CONFIG.SETTINGS.MAX_ITEMS.DEFAULT,
        filterThreshold: DOM.filterThreshold
          ? parseInt(DOM.filterThreshold.value) ||
            CONFIG.SETTINGS.FILTER_THRESHOLD.DEFAULT
          : CONFIG.SETTINGS.FILTER_THRESHOLD.DEFAULT,
        // Keep for backward compatibility
        hideNonMatching: DOM.hideNonMatching.checked,
      };

      chrome.storage.local.set({
        [`settings_${this.state.currentSite}`]: settings,
      });
    },

    /**
     * Apply filters
     */
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
      DOM.applyBtn.textContent = "Filtering...";
      DOM.applyBtn.disabled = true;
      DOM.applyBtn.classList.add("btn-loading");
      DOM.resultsCounter.innerHTML =
        "<span class='loading'>Processing...</span>";

      // Get settings
      const maxItems =
        parseInt(DOM.maxItems.value) || CONFIG.SETTINGS.MAX_ITEMS.DEFAULT;
      const filterThreshold = DOM.filterThreshold
        ? parseInt(DOM.filterThreshold.value) ||
          CONFIG.SETTINGS.FILTER_THRESHOLD.DEFAULT
        : CONFIG.SETTINGS.FILTER_THRESHOLD.DEFAULT;

      // Update backward compatibility setting
      if (DOM.filterThreshold) {
        DOM.hideNonMatching.checked =
          parseInt(DOM.filterThreshold.value) === this.state.filterCount;
      }

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
          DOM.resultsCounter.innerHTML = `<span class="no-matches">Error: ${errorMessage}</span>`;
        }
      } catch (error) {
        DOM.resultsCounter.innerHTML = `<span class="no-matches">Error: Content script not available</span>`;
      }

      // Reset button state
      DOM.applyBtn.innerHTML = `<svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>Apply Filters`;
      DOM.applyBtn.disabled = false;
      DOM.applyBtn.classList.remove("btn-loading");
    },

    /**
     * Reset filters
     */
    async resetFilters() {
      if (!this.state.isSupported) return;

      try {
        // Clear filter list and add a single empty filter
        DOM.filterList.innerHTML = "";
        this.addFilterRow("");  // Add a single empty filter

        this.saveFilters();
        this.updateFilterControls();

        // Reset content script filtering
        const tab = await this.getCurrentTab();
        await chrome.tabs.sendMessage(tab.id, { action: "resetFilters" });

        // Clear results
        this.state.results = null;
        chrome.storage.local.remove([`lastApplied_${this.state.currentSite}`]);
        DOM.resultsCounter.innerHTML = "<span>Filters reset</span>";
      } catch (error) {
        console.error("Failed to reset filters:", error);
      }
    },
  };

  // Initialize when DOM is loaded
  document.addEventListener("DOMContentLoaded", () => UI.init());
})();
