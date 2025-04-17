/**
 * SmartFilter Core - Handles product filtering logic
 */
class SmartFilterCore {
  constructor(vendor) {
    this.vendor = vendor;
    this.lastResults = { total: 0, matched: 0 };
    this.filteredProducts = null;
    this.hiddenElements = new Set();
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
        return { success: false, error: response?.error || "API error" };
      }

      this.filteredProducts = {
        products: response.products,
        items: productItems,
        filterThreshold,
        filters,
      };

      const matchCount = this._applyFiltersToDOM(
        response.products,
        productItems,
        filterThreshold,
      );

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

  _applyFiltersToDOM(products, productItems, threshold) {
    const productsByUrl = Object.fromEntries(
      products.map((product) => [product.url, product]),
    );

    let matchCount = 0;

    productItems.forEach(({ element, url }) => {
      const product = productsByUrl[url];
      if (!product) return;

      if (window.getComputedStyle(element).position === "static") {
        element.style.position = "relative";
      }

      const matchingFilters = product.filters.filter((f) => f.value).length;
      const totalFilters = product.filters.length;
      const thresholdToApply =
        threshold === totalFilters
          ? totalFilters
          : Math.min(threshold, totalFilters);

      const meetsThreshold = matchingFilters >= thresholdToApply;

      if (meetsThreshold) {
        matchCount++;
      } else {
        element.classList.add("smart-filter-hidden");
        this.hiddenElements.add(element);
      }

      this._addFilterBadges(element, product.filters);
    });

    return matchCount;
  }

  _addFilterBadges(element, filters) {
    if (!filters?.length) return;

    const targetEl = this.vendor.findImageContainer(element);
    element.querySelectorAll(".badge-container").forEach((el) => el.remove());

    const badgeContainer = document.createElement("div");
    badgeContainer.className = "badge-container";

    filters.forEach((filter) => {
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

  resetFiltering() {
    this.filteredProducts = null;
    this.lastResults = { total: 0, matched: 0 };

    this.hiddenElements.forEach((el) =>
      el.classList.remove("smart-filter-hidden"),
    );
    this.hiddenElements.clear();

    document.querySelectorAll(".badge-container").forEach((el) => el.remove());
    document.documentElement.removeAttribute("data-smart-filtered");
  }

  updateFilterThreshold(filterThreshold) {
    if (!this.filteredProducts) return { matched: 0, total: 0 };

    this.hiddenElements.forEach((el) =>
      el.classList.remove("smart-filter-hidden"),
    );
    this.hiddenElements.clear();

    const matchCount = this._applyFiltersToDOM(
      this.filteredProducts.products,
      this.filteredProducts.items,
      filterThreshold,
    );

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
