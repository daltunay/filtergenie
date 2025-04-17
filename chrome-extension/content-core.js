/**
 * SmartFilter - Core Functionality
 */

class SmartFilterCore {
  constructor(vendor) {
    this.vendor = vendor;
    this.lastResults = { total: 0, matched: 0 };
    this.filteredProducts = null;
    this.hiddenElements = new Set();
    this.dimmedElements = new Set();
    this._setupStyles();
  }

  _setupStyles() {
    const styleId = "smart-filter-styles";
    document.getElementById(styleId)?.remove();

    const styleEl = document.createElement("style");
    styleEl.id = styleId;
    styleEl.textContent = `
      .smart-filter-hidden {
        display: none !important;
        visibility: hidden !important;
        position: absolute !important;
        left: -9999px !important;
        pointer-events: none !important;
        height: 0 !important;
        overflow: hidden !important;
      }
      
      .smart-filter-dimmed {
        opacity: 0.5 !important;
        filter: grayscale(70%) !important;
      }

      .badge-container {
        z-index: 9999 !important;
        opacity: 1 !important;
        visibility: visible !important;
      }
    `;
    document.head.appendChild(styleEl);
  }

  async applyFilters(filters, maxItems, filterThreshold) {
    this.resetFiltering();

    const productItems = Array.from(this.vendor.getProductItems())
      .map((item) => {
        const link = item.querySelector("a");
        if (!link?.getAttribute("href")) return null;
        return { element: item, url: this.vendor.extractUrl(link) };
      })
      .filter(Boolean)
      .slice(0, maxItems);

    if (!productItems.length) {
      return { success: false, error: "No products found" };
    }

    try {
      const response = await this._callFilterAPI(
        filters,
        productItems.map((item) => item.url),
        maxItems,
      );

      if (!response?.success) {
        return { success: false, error: response?.error || "Unknown error" };
      }

      this.filteredProducts = {
        products: response.products,
        items: productItems,
        filterThreshold,
        filters,
      };

      const productsByUrl = Object.fromEntries(
        response.products.map((product) => [product.url, product]),
      );

      let matchCount = 0;
      productItems.forEach(({ element, url }) => {
        const product = productsByUrl[url];
        if (product) {
          this._applyFilteringToItem(element, product, filterThreshold);

          const matchingFilters = product.filters.filter((f) => f.value).length;
          const totalFilters = product.filters.length;
          const thresholdToApply =
            filterThreshold === totalFilters
              ? totalFilters
              : Math.min(filterThreshold, totalFilters);

          if (matchingFilters >= thresholdToApply) matchCount++;
        }
      });

      this.lastResults = {
        total: productItems.length,
        matched: matchCount,
        filters,
      };
      document.documentElement.setAttribute("data-smart-filtered", "true");

      return { success: true, matched: matchCount, total: productItems.length };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  resetFiltering() {
    this.filteredProducts = null;
    this.lastResults = { total: 0, matched: 0 };

    this.hiddenElements.forEach((el) =>
      this._toggleElementVisibility(el, true),
    );
    this.hiddenElements.clear();

    this.dimmedElements.forEach((el) => this._toggleElementOpacity(el, false));
    this.dimmedElements.clear();

    document.querySelectorAll(".badge-container").forEach((el) => el.remove());
    document.documentElement.removeAttribute("data-smart-filtered");
  }

  _applyFilteringToItem(element, product, filterThreshold) {
    if (window.getComputedStyle(element).position === "static") {
      element.style.position = "relative";
    }

    const matchingFilters = product.filters.filter((f) => f.value).length;
    const totalFilters = product.filters.length;
    const thresholdToApply =
      filterThreshold === totalFilters
        ? totalFilters
        : Math.min(filterThreshold, totalFilters);

    const meetsThreshold = matchingFilters >= thresholdToApply;

    if (!meetsThreshold) {
      this._toggleElementVisibility(element, false);
      this.hiddenElements.add(element);
    }

    if (product.filters?.length) {
      const targetEl = this.vendor.findImageContainer(element);
      element.querySelectorAll(".badge-container").forEach((el) => el.remove());

      const badgeContainer = document.createElement("div");
      badgeContainer.className = "badge-container";

      product.filters.forEach((filter) => {
        const badge = document.createElement("div");
        badge.className = `filter-badge ${!filter.value ? "filter-badge-negative" : ""}`;
        badge.textContent = `${filter.value ? "✓" : "✗"} ${filter.description}`;
        badgeContainer.appendChild(badge);
      });

      targetEl.appendChild(badgeContainer);
      if (window.getComputedStyle(targetEl).position === "static") {
        targetEl.style.position = "relative";
      }
    }
  }

  _toggleElementVisibility(element, show) {
    if (show) {
      element.classList.remove("smart-filter-hidden");
      element.removeAttribute("aria-hidden");
    } else {
      element.classList.add("smart-filter-hidden");
      element.setAttribute("aria-hidden", "true");
    }
  }

  _toggleElementOpacity(element, dim) {
    element.classList.toggle("smart-filter-dimmed", dim);
  }

  updateHideMode(hideNonMatching) {
    if (!this.filteredProducts) return;

    this.filteredProducts.hideNonMatching = hideNonMatching;

    this.hiddenElements.forEach((el) =>
      this._toggleElementVisibility(el, true),
    );
    this.hiddenElements.clear();

    this.dimmedElements.forEach((el) => this._toggleElementOpacity(el, false));
    this.dimmedElements.clear();

    const productsByUrl = Object.fromEntries(
      this.filteredProducts.products.map((product) => [product.url, product]),
    );

    this.filteredProducts.items.forEach(({ element, url }) => {
      const product = productsByUrl[url];
      if (product && !product.matches_filters) {
        if (hideNonMatching) {
          this._toggleElementVisibility(element, false);
          this.hiddenElements.add(element);
        } else {
          this._toggleElementOpacity(element, true);
          this.dimmedElements.add(element);
        }
      }
    });
  }

  updateFilterThreshold(filterThreshold) {
    if (!this.filteredProducts) return;

    this.filteredProducts.filterThreshold = filterThreshold;

    this.hiddenElements.forEach((el) =>
      this._toggleElementVisibility(el, true),
    );
    this.hiddenElements.clear();

    this.dimmedElements.forEach((el) => this._toggleElementOpacity(el, false));
    this.dimmedElements.clear();

    const productsByUrl = Object.fromEntries(
      this.filteredProducts.products.map((product) => [product.url, product]),
    );

    let matchCount = 0;
    this.filteredProducts.items.forEach(({ element, url }) => {
      const product = productsByUrl[url];
      if (product) {
        this._applyFilteringToItem(element, product, filterThreshold);

        const matchingFilters = product.filters.filter((f) => f.value).length;
        const totalFilters = product.filters.length;
        const thresholdToApply =
          filterThreshold === totalFilters
            ? totalFilters
            : Math.min(filterThreshold, totalFilters);

        if (matchingFilters >= thresholdToApply) matchCount++;
      }
    });

    this.lastResults.matched = matchCount;
    return { matched: matchCount, total: this.lastResults.total };
  }

  async _callFilterAPI(filters, productUrls, maxItems) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: "filterProducts", filters, productUrls, maxItems },
        (response) =>
          chrome.runtime.lastError
            ? reject(chrome.runtime.lastError)
            : resolve(response),
      );
    });
  }
}
