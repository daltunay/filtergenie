/**
 * FilterGenie Core - Handles product filtering logic
 * Simplified implementation
 */
class SmartFilterCore {
  constructor(platform) {
    this.platform = platform;
    this.lastResults = { total: 0, matched: 0 };
    this.filteredProducts = null;
    this.hiddenElements = new Set();
    this.fetchingInProgress = false;
  }

  async applyFilters(filters, maxItems, filterThreshold) {
    if (this.fetchingInProgress) {
      return { success: false, error: "Filter operation already in progress" };
    }

    try {
      this.fetchingInProgress = true;
      this.resetFiltering();

      let productData;
      if (this.platform.pageType === "product") {
        productData = await this._getProductPageData();
      } else {
        productData = await this._getSearchPageData(maxItems);
      }

      if (!productData.success) {
        return productData;
      }

      const analysisResult = await this._analyzeProducts(
        filters,
        productData.urls,
        productData.htmlContents,
        filterThreshold,
      );

      if (!analysisResult?.success) {
        return { success: false, error: analysisResult?.error || "API error" };
      }

      let matchCount = 0;
      if (this.platform.pageType === "product") {
        const product = analysisResult.products[0];
        if (product) {
          const targetContainer =
            document.querySelector("main") || document.body;
          this._addFilterBadges(targetContainer, product.filters);
          matchCount = product.matches_all_filters() ? 1 : 0;
        }
      } else {
        matchCount = this._applyFiltersToDOM(
          analysisResult.products,
          productData.items,
          filterThreshold,
        );
      }

      const total = productData.items?.length || 1;

      this.lastResults = {
        total: total,
        matched: matchCount,
        filters,
      };

      document.documentElement.setAttribute("data-smart-filtered", "true");

      this.filteredProducts = {
        products: analysisResult.products,
        items: productData.items,
        filterThreshold,
        filters,
      };

      return {
        success: true,
        matched: matchCount,
        total: total,
      };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      this.fetchingInProgress = false;
    }
  }

  async _getProductPageData() {
    const url = window.location.href;
    document.body.classList.add("smart-filter-loading");

    try {
      const html = await this._fetchHtml(url);

      if (!html) {
        return { success: false, error: "Failed to fetch HTML content" };
      }

      return {
        success: true,
        urls: [url],
        htmlContents: [html],
        items: [{ element: document.body }],
      };
    } finally {
      document.body.classList.remove("smart-filter-loading");
    }
  }

  async _getSearchPageData(maxItems) {
    const productItems = this._getValidProductItems(maxItems);

    if (!productItems.length) {
      return { success: false, error: "No products found" };
    }

    const productUrls = productItems.map((item) => item.url);
    this._toggleLoadingState(productItems, true);

    try {
      const htmlContents = await Promise.all(
        productUrls.map((url) => this._fetchHtml(url)),
      );

      const validProductData = this._getValidProductData(
        productItems,
        productUrls,
        htmlContents,
      );

      if (!validProductData.valid) {
        return { success: false, error: "Failed to fetch HTML content" };
      }

      return {
        success: true,
        urls: validProductData.urls,
        htmlContents: validProductData.htmlContents,
        items: validProductData.items,
      };
    } finally {
      this._toggleLoadingState(productItems, false);
    }
  }

  async _analyzeProducts(filters, urls, htmlContents, threshold) {
    return await chrome.runtime.sendMessage({
      action: "analyzeProducts",
      filters,
      productUrls: urls,
      htmlContents: htmlContents,
      threshold: threshold || 1,
    });
  }

  _getValidProductItems(maxItems) {
    return Array.from(this.platform.getProductItems())
      .map((item) => {
        const link = item.querySelector("a");
        if (!link) return null;

        const url = this.platform.extractUrl(link);
        if (!url) return null;

        return { element: item, url };
      })
      .filter(Boolean)
      .slice(0, maxItems);
  }

  _toggleLoadingState(productItems, isLoading) {
    productItems.forEach(({ element }) => {
      element.classList.toggle("smart-filter-loading", isLoading);
    });
  }

  _getValidProductData(productItems, productUrls, htmlContents) {
    const validData = productItems
      .map((item, index) =>
        htmlContents[index]
          ? { item, url: productUrls[index], html: htmlContents[index] }
          : null,
      )
      .filter(Boolean);

    return {
      valid: validData.length > 0,
      urls: validData.map((d) => d.url),
      htmlContents: validData.map((d) => d.html),
      items: validData.map((d) => d.item),
    };
  }

  async _fetchHtml(url) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "fetchHtml",
        url,
      });
      return response?.success ? response.html : null;
    } catch {
      return null;
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

    const targetEl = this.platform.findImageContainer(element);
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
}
