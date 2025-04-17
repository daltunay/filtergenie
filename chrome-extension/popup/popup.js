/**
 * Smart E-commerce Filter - Popup UI
 */
(function () {
  // Configuration
  const SUPPORTED_DOMAINS = ["leboncoin.fr", "vinted.fr", "ebay.fr"];
  const DEFAULT_FILTERS = [
    "Is this in excellent condition?",
    "Is this a good deal?",
    "Does this look authentic?",
  ];

  /**
   * Core UI module
   */
  const UI = {
    // DOM elements
    elements: {},

    // Application state
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
     * Cache DOM elements
     */
    cacheElements() {
      // Helper function to get elements
      const get = (id) => document.getElementById(id);

      this.elements = {
        statusIcon: get("status-icon"),
        currentSite: get("current-site"),
        siteMessage: get("site-message"),
        filterPanel: get("filter-panel"),
        filterList: get("filter-list"),
        maxItems: get("max-items"),
        filterThreshold: get("filter-threshold"),
        thresholdValue: get("threshold-value"),
        addFilterBtn: get("add-filter-btn"),
        applyBtn: get("apply-btn"),
        resetBtn: get("reset-btn"),
        resultsCounter: get("results-counter"),
        // Backward compatibility with the old hideNonMatching option
        hideNonMatching: { checked: false },
      };
    },

    /**
     * Set up event listeners
     */
    setupEventListeners() {
      // Filter management
      this.elements.addFilterBtn.addEventListener("click", () =>
        this.addFilterRow(),
      );

      // Settings
      this.elements.maxItems.addEventListener("change", () =>
        this.saveSettings(),
      );
      this.elements.filterThreshold.addEventListener("input", () =>
        this.updateThresholdDisplay(),
      );
      this.elements.filterThreshold.addEventListener("change", () =>
        this.handleThresholdChange(),
      );

      // Number input controls
      document
        .getElementById("increase-max")
        .addEventListener("click", () => this.changeMaxItems(1));
      document
        .getElementById("decrease-max")
        .addEventListener("click", () => this.changeMaxItems(-1));

      // Action buttons
      this.elements.applyBtn.addEventListener("click", () =>
        this.applyFilters(),
      );
      this.elements.resetBtn.addEventListener("click", () =>
        this.resetFilters(),
      );
    },

    /**
     * Change max items value
     */
    changeMaxItems(delta) {
      const input = this.elements.maxItems;
      const newValue = Math.min(
        Math.max(parseInt(input.min), parseInt(input.value) + delta),
        parseInt(input.max),
      );
      input.value = newValue;
      this.saveSettings();
    },

    /**
     * Update threshold display text
     */
    updateThresholdDisplay() {
      if (!this.elements.thresholdValue) return;

      const value = parseInt(this.elements.filterThreshold.value);
      const maxValue = parseInt(this.elements.filterThreshold.max);

      let text;
      if (value === 0) {
        text = "Show all products";
      } else if (value === maxValue && value > 1) {
        text = "All criteria required";
      } else if (value === 1) {
        text = "At least 1 criterion";
      } else {
        text = `At least ${value} criteria`;
      }

      this.elements.thresholdValue.textContent = text;
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
            filterThreshold: parseInt(this.elements.filterThreshold.value),
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
        const isDomainSupported = SUPPORTED_DOMAINS.some((domain) =>
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
          name: SUPPORTED_DOMAINS.find((domain) =>
            url.hostname.includes(domain),
          ),
        });
      } catch (error) {
        this.updateSiteStatus(false);
      }
    },

    /**
     * Update site status in UI
     */
    updateSiteStatus(isCompatible, vendor = null) {
      const { statusIcon, currentSite, siteMessage, filterPanel } =
        this.elements;

      if (isCompatible) {
        statusIcon.classList.remove("not-compatible");
        statusIcon.classList.add("compatible");
        statusIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>`;

        currentSite.textContent = vendor ? vendor.name : "Compatible site";
        siteMessage.textContent = "You can use filters on this site!";
        filterPanel.style.display = "flex";
      } else {
        statusIcon.classList.remove("compatible");
        statusIcon.classList.add("not-compatible");
        statusIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>`;

        currentSite.textContent = "Not a supported site";
        siteMessage.textContent =
          "Navigate to a supported e-commerce site to use this extension.";
        filterPanel.style.display = "none";
      }
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
        maxItems: 5,
        filterThreshold: 1,
      };

      // Get results or set defaults
      this.state.results = stored[`lastApplied_${currentSite}`] || null;

      // Update UI
      this.elements.maxItems.value = settings.maxItems;

      // Handle backward compatibility
      if (settings.hideNonMatching !== undefined) {
        this.elements.hideNonMatching.checked = settings.hideNonMatching;
        settings.filterThreshold = settings.hideNonMatching
          ? filters.length || 1
          : settings.filterThreshold || 1;
      }

      // Populate filter list
      const filterList = this.elements.filterList;
      filterList.innerHTML = "";

      if (filters.length > 0) {
        filters.forEach((filter) => this.addFilterRow(filter));
      } else {
        this.addFilterRow("");
      }

      // Update threshold settings
      this.state.filterCount = Math.max(1, filters.length);
      if (this.elements.filterThreshold) {
        this.elements.filterThreshold.max = this.state.filterCount;
        this.elements.filterThreshold.value = Math.min(
          settings.filterThreshold || 1,
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
      const { resultsCounter } = this.elements;
      const { results } = this.state;

      if (!results) {
        resultsCounter.innerHTML = "<span>No filters applied yet</span>";
        return;
      }

      const { matched, total } = results;
      resultsCounter.innerHTML = `<span class="${matched === 0 ? "no-matches" : ""}">
        Matched <strong>${matched}</strong> of ${total} items
      </span>`;
    },

    /**
     * Add a filter row
     */
    addFilterRow(value = "") {
      const filterList = this.elements.filterList;

      // Create row container
      const row = document.createElement("div");
      row.className = "filter-row";

      // Create input field
      const input = document.createElement("input");
      input.type = "text";
      input.value = value;
      input.placeholder = value ? "" : "Enter filter criteria";

      // Add input event listeners
      input.addEventListener("change", () => this.saveFilters());
      input.addEventListener("input", () => this.updateFilterControls());
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
      this.elements.addFilterBtn.disabled =
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

      // Update threshold slider max value
      this.state.filterCount = filterInputs.length;
      if (this.elements.filterThreshold) {
        this.elements.filterThreshold.max = this.state.filterCount;
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
    },

    /**
     * Save settings to storage
     */
    saveSettings() {
      const settings = {
        maxItems: parseInt(this.elements.maxItems.value) || 5,
        filterThreshold: this.elements.filterThreshold
          ? parseInt(this.elements.filterThreshold.value) || 1
          : 1,
        // Keep for backward compatibility
        hideNonMatching: this.elements.hideNonMatching.checked,
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
      this.elements.applyBtn.textContent = "Filtering...";
      this.elements.applyBtn.disabled = true;
      this.elements.applyBtn.classList.add("btn-loading");
      this.elements.resultsCounter.innerHTML =
        "<span class='loading'>Processing...</span>";

      // Get settings
      const maxItems = parseInt(this.elements.maxItems.value) || 5;
      const filterThreshold = this.elements.filterThreshold
        ? parseInt(this.elements.filterThreshold.value) || 1
        : 1;

      // Update backward compatibility setting
      if (this.elements.filterThreshold) {
        this.elements.hideNonMatching.checked =
          parseInt(this.elements.filterThreshold.value) ===
          this.state.filterCount;
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
          this.elements.resultsCounter.innerHTML = `<span class="no-matches">Error: ${errorMessage}</span>`;
        }
      } catch (error) {
        this.elements.resultsCounter.innerHTML = `<span class="no-matches">Error: Content script not available</span>`;
      }

      // Reset button state
      this.elements.applyBtn.innerHTML = `<svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>Apply Filters`;
      this.elements.applyBtn.disabled = false;
      this.elements.applyBtn.classList.remove("btn-loading");
    },

    /**
     * Reset filters
     */
    async resetFilters() {
      if (!this.state.isSupported) return;

      try {
        // Clear filter list and add default filters
        this.elements.filterList.innerHTML = "";

        (DEFAULT_FILTERS.length > 0 ? DEFAULT_FILTERS : [""]).forEach(
          (filter) => this.addFilterRow(filter),
        );

        this.saveFilters();
        this.updateFilterControls();

        // Reset content script filtering
        const tab = await this.getCurrentTab();
        await chrome.tabs.sendMessage(tab.id, { action: "resetFilters" });

        // Clear results
        this.state.results = null;
        chrome.storage.local.remove([`lastApplied_${this.state.currentSite}`]);
        this.elements.resultsCounter.innerHTML = "<span>Filters reset</span>";
      } catch (error) {
        console.error("Failed to reset filters:", error);
      }
    },
  };

  // Initialize when DOM is loaded
  document.addEventListener("DOMContentLoaded", () => UI.init());
})();
