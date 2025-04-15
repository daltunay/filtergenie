/**
 * Smart E-commerce Filter - Popup UI Module
 *
 * This script handles the popup UI shown when clicking the extension icon.
 * It manages:
 * - Detection of compatible sites
 * - Loading and saving of filter settings
 * - Communication with content scripts
 * - User interaction with filter controls
 * - Application of filters to product pages
 */

const supportedDomains = ["leboncoin.fr", "vinted.fr", "ebay.fr"];

const appState = {
  isOnSupportedPage: false,
  currentVendor: null,
  currentHostname: "",
  lastResults: null,
  defaultFilters: window.DEFAULT_FILTERS || [
    "Is this in excellent condition?",
    "Is this a good deal?",
    "Does this look authentic?",
  ],

  async init() {
    await this.detectCurrentSite();
    await this.loadStoredState();
    await this.syncWithContentScript();
    this.setupEventListeners();
  },

  async detectCurrentSite() {
    try {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const currentTab = tabs[0];

      if (!currentTab?.url) {
        this.updateSiteStatus(false);
        return;
      }

      const url = new URL(currentTab.url);
      this.currentHostname = url.hostname;

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
          this.isOnSupportedPage = true;
          this.currentVendor = response.vendor;

          if (window.DEFAULT_FILTERS?.length > 0) {
            this.defaultFilters = window.DEFAULT_FILTERS;
          }

          this.updateSiteStatus(true, response.vendor);
          return;
        }
      } catch (error) {
        console.log("Content script not ready:", error);
      }

      this.isOnSupportedPage = true;
      this.updateSiteStatus(true, {
        name: supportedDomains.find((domain) => url.hostname.includes(domain)),
      });
    } catch (error) {
      console.error("Error detecting site:", error);
      this.updateSiteStatus(false);
    }
  },

  updateSiteStatus(isCompatible, vendor = null) {
    const statusIcon = document.querySelector(".status-icon");
    const currentSiteText = document.getElementById("current-site");
    const siteMessage = document.getElementById("site-message");
    const filterPanel = document.getElementById("filter-panel");

    if (isCompatible) {
      statusIcon.classList.remove("not-compatible");
      statusIcon.classList.add("compatible");
      statusIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>`;

      currentSiteText.textContent = vendor ? vendor.name : "Compatible site";
      siteMessage.textContent = "You can use filters on this site!";
      filterPanel.style.display = "block";
    } else {
      statusIcon.classList.remove("compatible");
      statusIcon.classList.add("not-compatible");
      statusIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>`;

      currentSiteText.textContent = "Not a supported site";
      siteMessage.textContent =
        "Navigate to a supported e-commerce site to use this extension.";
      filterPanel.style.display = "none";
    }
  },

  async loadStoredState() {
    if (!this.isOnSupportedPage) return;

    const stored = await chrome.storage.local.get([
      `filters_${this.currentHostname}`,
      `settings_${this.currentHostname}`,
      `lastApplied_${this.currentHostname}`,
    ]);

    const filters = stored[`filters_${this.currentHostname}`] || [];
    const settings = stored[`settings_${this.currentHostname}`] || {
      maxItems: 5,
      hideNonMatching: false,
    };
    this.lastResults = stored[`lastApplied_${this.currentHostname}`] || null;

    document.getElementById("max-items").value = settings.maxItems;
    document.getElementById("hide-non-matching").checked =
      settings.hideNonMatching;

    const filterList = document.getElementById("filter-list");
    filterList.innerHTML = "";

    if (filters.length > 0) {
      filters.forEach((filter) => this.addFilterRow(filter));
    } else {
      this.defaultFilters.forEach((filter) => this.addFilterRow(filter));
    }

    this.updateResultsDisplay();
  },

  async syncWithContentScript() {
    if (!this.isOnSupportedPage) return;

    try {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const response = await chrome.tabs.sendMessage(tabs[0].id, {
        action: "getFilterState",
      });

      if (response?.success && response.isApplied) {
        this.lastResults = {
          matched: response.matched,
          total: response.total,
          timestamp: Date.now(),
        };
        this.updateResultsDisplay();
      }
    } catch (error) {
      console.log("Could not sync with content script:", error);
    }
  },

  updateResultsDisplay() {
    const resultsCounter = document.getElementById("results-counter");

    if (!this.lastResults) {
      resultsCounter.innerHTML = "<span>No filters applied yet</span>";
      return;
    }

    const { matched, total } = this.lastResults;
    resultsCounter.innerHTML = `<span class="${matched === 0 ? "no-matches" : ""}">
      Matched <strong>${matched}</strong> of ${total} items
    </span>`;
  },

  setupEventListeners() {
    document.getElementById("increase-max").addEventListener("click", () => {
      const input = document.getElementById("max-items");
      input.value = Math.min(
        parseInt(input.max),
        (parseInt(input.value) || 5) + 1,
      );
      this.saveSettings();
    });

    document.getElementById("decrease-max").addEventListener("click", () => {
      const input = document.getElementById("max-items");
      input.value = Math.max(
        parseInt(input.min),
        (parseInt(input.value) || 5) - 1,
      );
      this.saveSettings();
    });

    document
      .getElementById("max-items")
      .addEventListener("change", () => this.saveSettings());

    document
      .getElementById("hide-non-matching")
      .addEventListener("change", async (e) => {
        this.saveSettings();

        if (this.lastResults) {
          try {
            const tabs = await chrome.tabs.query({
              active: true,
              currentWindow: true,
            });
            await chrome.tabs.sendMessage(tabs[0].id, {
              action: "updateHideMode",
              hideNonMatching: e.target.checked,
            });
          } catch (error) {
            console.error("Failed to update hide mode in real-time:", error);
          }
        }
      });

    document.getElementById("add-filter-btn").addEventListener("click", () => {
      this.addFilterRow("");
      this.saveFilters();
    });

    document
      .getElementById("apply-btn")
      .addEventListener("click", () => this.applyFilters());

    document
      .getElementById("reset-btn")
      .addEventListener("click", () => this.resetFilters());
  },

  addFilterRow(value) {
    const filterList = document.getElementById("filter-list");

    const row = document.createElement("div");
    row.className = "filter-row";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "filter-input";
    input.value = value;
    input.placeholder = value ? "" : "Enter filter criteria";

    input.addEventListener("change", () => this.saveFilters());
    input.addEventListener("blur", () => this.saveFilters());

    const removeBtn = document.createElement("button");
    removeBtn.className = "filter-remove-btn";
    removeBtn.innerHTML = "×";
    removeBtn.title = "Remove filter";
    removeBtn.onclick = () => {
      row.style.opacity = "0";
      row.style.transform = "translateY(10px)";
      setTimeout(() => {
        row.remove();
        this.saveFilters();
      }, 300);
    };

    row.appendChild(input);
    row.appendChild(removeBtn);
    filterList.appendChild(row);

    if (!value) {
      setTimeout(() => input.focus(), 50);
    }

    return row;
  },

  saveFilters() {
    const filters = Array.from(document.querySelectorAll(".filter-input"))
      .map((input) => input.value.trim())
      .filter((text) => text !== "");

    chrome.storage.local.set({
      [`filters_${this.currentHostname}`]: filters,
    });
  },

  saveSettings() {
    const settings = {
      maxItems: parseInt(document.getElementById("max-items").value) || 5,
      hideNonMatching: document.getElementById("hide-non-matching").checked,
    };

    chrome.storage.local.set({
      [`settings_${this.currentHostname}`]: settings,
    });
  },

  async applyFilters() {
    if (!this.isOnSupportedPage) return;

    const applyBtn = document.getElementById("apply-btn");
    applyBtn.textContent = "Filtering...";
    applyBtn.disabled = true;
    applyBtn.classList.add("btn-loading");

    const resultsCounter = document.getElementById("results-counter");
    resultsCounter.innerHTML =
      "<span class='loading-text'>Processing...</span>";

    const filters = Array.from(document.querySelectorAll(".filter-input"))
      .map((input) => input.value.trim())
      .filter((text) => text !== "");

    this.saveFilters();

    if (filters.length === 0) {
      alert("Please add at least one filter");
      this.resetApplyButton(applyBtn);
      return;
    }

    const maxItems = parseInt(document.getElementById("max-items").value) || 5;
    const hideNonMatching =
      document.getElementById("hide-non-matching").checked;
    this.saveSettings();

    try {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const response = await chrome.tabs.sendMessage(tabs[0].id, {
        action: "applyFilters",
        filters,
        maxItems,
        hideNonMatching,
      });

      if (response?.success) {
        this.lastResults = {
          matched: response.matched,
          total: response.total,
          timestamp: Date.now(),
          filters,
        };

        chrome.storage.local.set({
          [`lastApplied_${this.currentHostname}`]: this.lastResults,
        });

        this.updateResultsDisplay();
      } else {
        const errorMessage = response?.error || "Unknown error";
        resultsCounter.innerHTML = `<span class="error-text">Error: ${errorMessage}</span>`;
      }
    } catch (error) {
      resultsCounter.innerHTML = `<span class="error-text">Error: Content script not available</span>`;
      console.error("Failed to communicate with content script:", error);
    }

    this.resetApplyButton(applyBtn);
  },

  resetApplyButton(button) {
    button.innerHTML = `<svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>Apply Filters`;
    button.disabled = false;
    button.classList.remove("btn-loading");
  },

  async resetFilters() {
    if (!this.isOnSupportedPage) return;

    try {
      const filterList = document.getElementById("filter-list");
      filterList.innerHTML = "";

      this.defaultFilters.forEach((filter) => this.addFilterRow(filter));

      this.saveFilters();

      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      await chrome.tabs.sendMessage(tabs[0].id, {
        action: "resetFilters",
      });

      this.lastResults = null;
      chrome.storage.local.remove([`lastApplied_${this.currentHostname}`]);

      const resultsCounter = document.getElementById("results-counter");
      resultsCounter.innerHTML = "<span>Filters reset</span>";
    } catch (error) {
      console.error("Failed to reset filters:", error);
    }
  },
};

document.addEventListener("DOMContentLoaded", () => {
  appState.init();
});
