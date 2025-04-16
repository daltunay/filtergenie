/**
 * Smart E-commerce Filter - Popup UI Module
 */

(function () {
  const supportedDomains = ["leboncoin.fr", "vinted.fr", "ebay.fr"];

  const app = {
    state: {
      isOnSupportedPage: false,
      currentVendor: null,
      currentHostname: "",
      lastResults: null,
      defaultFilters: window.DEFAULT_FILTERS || [],
    },

    elements: {},

    async init() {
      this.cacheElements();
      await this.detectCurrentSite();
      await this.loadStoredState();
      await this.syncWithContentScript();
      this.setupEventListeners();
    },

    cacheElements() {
      this.elements = {
        statusIcon: document.querySelector(".status-icon"),
        currentSite: document.getElementById("current-site"),
        siteMessage: document.getElementById("site-message"),
        filterPanel: document.getElementById("filter-panel"),
        filterList: document.getElementById("filter-list"),
        maxItems: document.getElementById("max-items"),
        hideNonMatching: document.getElementById("hide-non-matching"),
        resultsCounter: document.getElementById("results-counter"),
        applyBtn: document.getElementById("apply-btn"),
        resetBtn: document.getElementById("reset-btn"),
        addFilterBtn: document.getElementById("add-filter-btn"),
      };
    },

    async getCurrentTab() {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      return tabs[0];
    },

    async detectCurrentSite() {
      try {
        const currentTab = await this.getCurrentTab();
        if (!currentTab?.url) {
          this.updateSiteStatus(false);
          return;
        }

        const url = new URL(currentTab.url);
        this.state.currentHostname = url.hostname;

        const isDomainSupported = supportedDomains.some((domain) =>
          url.hostname.includes(domain),
        );

        if (!isDomainSupported) {
          this.updateSiteStatus(false);
          return;
        }

        try {
          const response = await chrome.tabs.sendMessage(currentTab.id, {
            action: "getVendorInfo",
          });

          if (response?.success) {
            this.state.isOnSupportedPage = true;
            this.state.currentVendor = response.vendor;
            this.state.defaultFilters =
              response.defaultFilters?.length > 0
                ? response.defaultFilters
                : this.state.defaultFilters;

            this.updateSiteStatus(true, response.vendor);
            return;
          }
        } catch (error) {
          console.log("Content script not ready");
        }

        this.state.isOnSupportedPage = true;
        this.updateSiteStatus(true, {
          name: supportedDomains.find((domain) =>
            url.hostname.includes(domain),
          ),
        });
      } catch (error) {
        this.updateSiteStatus(false);
      }
    },

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
        filterPanel.style.display = "block";
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

    async loadStoredState() {
      if (!this.state.isOnSupportedPage) return;

      const { currentHostname } = this.state;
      const stored = await chrome.storage.local.get([
        `filters_${currentHostname}`,
        `settings_${currentHostname}`,
        `lastApplied_${currentHostname}`,
      ]);

      const filters = stored[`filters_${currentHostname}`] || [];
      const settings = stored[`settings_${currentHostname}`] || {
        maxItems: 5,
        hideNonMatching: false,
      };

      this.state.lastResults = stored[`lastApplied_${currentHostname}`] || null;

      this.elements.maxItems.value = settings.maxItems;
      this.elements.hideNonMatching.checked = settings.hideNonMatching;

      const filterList = this.elements.filterList;
      filterList.innerHTML = "";

      if (filters.length > 0) {
        filters.forEach((filter) => this.addFilterRow(filter));
      } else {
        this.addFilterRow("");
      }

      this.updateResultsDisplay();
      this.updateAddFilterButtonState();
      this.updateRemoveButtonsState();
    },

    updateAddFilterButtonState() {
      const filterInputs = document.querySelectorAll(".filter-input");
      const addFilterBtn = this.elements.addFilterBtn;

      if (filterInputs.length === 0) {
        addFilterBtn.disabled = false;
        return;
      }

      const lastInput = filterInputs[filterInputs.length - 1];
      addFilterBtn.disabled = lastInput.value.trim() === "";
    },

    async syncWithContentScript() {
      if (!this.state.isOnSupportedPage) return;

      try {
        const tab = await this.getCurrentTab();
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: "getFilterState",
        });

        if (response?.success && response.isApplied) {
          this.state.lastResults = {
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
      const { resultsCounter } = this.elements;
      const { lastResults } = this.state;

      if (!lastResults) {
        resultsCounter.innerHTML = "<span>No filters applied yet</span>";
        return;
      }

      const { matched, total } = lastResults;
      resultsCounter.innerHTML = `<span class="${matched === 0 ? "no-matches" : ""}">
        Matched <strong>${matched}</strong> of ${total} items
      </span>`;
    },

    setupEventListeners() {
      document.getElementById("increase-max").addEventListener("click", () => {
        const input = this.elements.maxItems;
        input.value = Math.min(
          parseInt(input.max),
          (parseInt(input.value) || 5) + 1,
        );
        this.saveSettings();
      });

      document.getElementById("decrease-max").addEventListener("click", () => {
        const input = this.elements.maxItems;
        input.value = Math.max(
          parseInt(input.min),
          (parseInt(input.value) || 5) - 1,
        );
        this.saveSettings();
      });

      this.elements.maxItems.addEventListener("change", () =>
        this.saveSettings(),
      );

      this.elements.hideNonMatching.addEventListener("change", async (e) => {
        this.saveSettings();

        if (this.state.lastResults) {
          try {
            const tab = await this.getCurrentTab();
            await chrome.tabs.sendMessage(tab.id, {
              action: "updateHideMode",
              hideNonMatching: e.target.checked,
            });
          } catch (error) {
            console.error("Failed to update hide mode in real-time");
          }
        }
      });

      this.elements.addFilterBtn.addEventListener("click", () => {
        this.addFilterRow("");
        this.saveFilters();
      });

      this.elements.applyBtn.addEventListener("click", () =>
        this.applyFilters(),
      );
      this.elements.resetBtn.addEventListener("click", () =>
        this.resetFilters(),
      );
    },

    addFilterRow(value) {
      const filterList = this.elements.filterList;

      const row = document.createElement("div");
      row.className = "filter-row";

      const input = document.createElement("input");
      input.type = "text";
      input.className = "filter-input";
      input.value = value;
      input.placeholder = value ? "" : "Enter filter criteria";

      input.addEventListener("change", () => {
        this.saveFilters();
        this.updateAddFilterButtonState();
      });

      input.addEventListener("input", () => {
        this.updateAddFilterButtonState();
      });

      input.addEventListener("blur", () => {
        this.saveFilters();
        this.updateAddFilterButtonState();
      });

      const removeBtn = document.createElement("button");
      removeBtn.className = "filter-remove-btn";
      removeBtn.innerHTML = "×";
      removeBtn.title = "Remove filter";
      removeBtn.onclick = () => {
        if (document.querySelectorAll(".filter-row").length <= 1) {
          return;
        }

        row.style.opacity = "0";
        row.style.transform = "translateY(10px)";
        setTimeout(() => {
          row.remove();
          this.saveFilters();

          if (document.querySelectorAll(".filter-row").length === 0) {
            this.addFilterRow("");
          }

          this.updateAddFilterButtonState();
          this.updateRemoveButtonsState();
        }, 300);
      };

      row.appendChild(input);
      row.appendChild(removeBtn);
      filterList.appendChild(row);

      if (!value) {
        setTimeout(() => input.focus(), 50);
      }

      this.updateAddFilterButtonState();
      this.updateRemoveButtonsState();

      return row;
    },

    updateRemoveButtonsState() {
      const filterRows = document.querySelectorAll(".filter-row");
      const removeButtons = document.querySelectorAll(".filter-remove-btn");

      if (filterRows.length <= 1) {
        removeButtons.forEach((btn) => {
          btn.disabled = true;
          btn.classList.add("btn-disabled");
          btn.title = "Cannot remove the last filter";
        });
      } else {
        removeButtons.forEach((btn) => {
          btn.disabled = false;
          btn.classList.remove("btn-disabled");
          btn.title = "Remove filter";
        });
      }
    },

    saveFilters() {
      const filters = Array.from(document.querySelectorAll(".filter-input"))
        .map((input) => input.value.trim())
        .filter((text) => text !== "");

      chrome.storage.local.set({
        [`filters_${this.state.currentHostname}`]: filters,
      });
    },

    saveSettings() {
      const settings = {
        maxItems: parseInt(this.elements.maxItems.value) || 5,
        hideNonMatching: this.elements.hideNonMatching.checked,
      };

      chrome.storage.local.set({
        [`settings_${this.state.currentHostname}`]: settings,
      });
    },

    async applyFilters() {
      if (!this.state.isOnSupportedPage) return;

      const { applyBtn, resultsCounter } = this.elements;

      applyBtn.textContent = "Filtering...";
      applyBtn.disabled = true;
      applyBtn.classList.add("btn-loading");
      resultsCounter.innerHTML =
        "<span class='loading-text'>Processing...</span>";

      const filters = Array.from(document.querySelectorAll(".filter-input"))
        .map((input) => input.value.trim())
        .filter((text) => text !== "");

      this.saveFilters();

      if (filters.length === 0) {
        alert("Please add at least one filter");
        this.resetApplyButton();
        return;
      }

      const maxItems = parseInt(this.elements.maxItems.value) || 5;
      const hideNonMatching = this.elements.hideNonMatching.checked;
      this.saveSettings();

      try {
        const tab = await this.getCurrentTab();
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: "applyFilters",
          filters,
          maxItems,
          hideNonMatching,
        });

        if (response?.success) {
          this.state.lastResults = {
            matched: response.matched,
            total: response.total,
            timestamp: Date.now(),
            filters,
          };

          chrome.storage.local.set({
            [`lastApplied_${this.state.currentHostname}`]:
              this.state.lastResults,
          });

          this.updateResultsDisplay();
        } else {
          const errorMessage = response?.error || "Unknown error";
          resultsCounter.innerHTML = `<span class="error-text">Error: ${errorMessage}</span>`;
        }
      } catch (error) {
        resultsCounter.innerHTML = `<span class="error-text">Error: Content script not available</span>`;
      }

      this.resetApplyButton();
    },

    resetApplyButton() {
      const { applyBtn } = this.elements;
      applyBtn.innerHTML = `<svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>Apply Filters`;
      applyBtn.disabled = false;
      applyBtn.classList.remove("btn-loading");
    },

    async resetFilters() {
      if (!this.state.isOnSupportedPage) return;

      try {
        this.elements.filterList.innerHTML = "";
        this.state.defaultFilters.forEach((filter) =>
          this.addFilterRow(filter),
        );

        if (this.state.defaultFilters.length === 0) {
          this.addFilterRow("");
        }

        this.saveFilters();
        this.updateAddFilterButtonState();
        this.updateRemoveButtonsState();

        const tab = await this.getCurrentTab();
        await chrome.tabs.sendMessage(tab.id, { action: "resetFilters" });

        this.state.lastResults = null;
        chrome.storage.local.remove([
          `lastApplied_${this.state.currentHostname}`,
        ]);
        this.elements.resultsCounter.innerHTML = "<span>Filters reset</span>";
      } catch (error) {
        console.error("Failed to reset filters:", error);
      }
    },
  };

  document.addEventListener("DOMContentLoaded", () => app.init());
})();
