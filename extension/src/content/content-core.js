/**
 * SmartFilter Core - Handles product filtering logic
 * Simplified implementation
 */
class SmartFilterCore {
  constructor(vendor) {
    this.vendor = vendor;
    this.lastResults = { total: 0, matched: 0 };
    this.filteredProducts = null;
    this.hiddenElements = new Set();
    this.fetchingInProgress = false;
  }

  async applyFilters(filters, maxItems, filterThreshold) {
    // Prevent multiple filter operations
    if (this.fetchingInProgress) {
      return { success: false, error: "Filter operation already in progress" };
    }

    try {
      this.fetchingInProgress = true;
      this.resetFiltering();

      // Get product items from the page
      const productItems = this._getValidProductItems(maxItems);
      if (!productItems.length) {
        this.fetchingInProgress = false;
        return { success: false, error: "No products found" };
      }

      console.log(`Filtering ${productItems.length} products`);

      // Extract URLs for all products
      const productUrls = productItems.map((item) => item.url);

      // Show loading indicators
      this._showLoadingState(productItems);

      // Fetch HTML content for all products in parallel
      const htmlContents = await this._fetchAllProductsHtml(productUrls);

      // Process valid products only
      const validProductData = this._getValidProductData(
        productItems,
        productUrls,
        htmlContents,
      );
      if (!validProductData.valid) {
        this._hideLoadingState(productItems);
        this.fetchingInProgress = false;
        return { success: false, error: "Failed to fetch HTML content" };
      }

      // Send to backend API for analysis
      const analysisResult = await this._analyzeProducts(
        filters,
        validProductData.urls,
        validProductData.htmlContents,
        validProductData.items,
        filterThreshold,
      );

      // Hide loading indicators
      this._hideLoadingState(productItems);

      if (!analysisResult.success) {
        this.fetchingInProgress = false;
        return analysisResult;
      }

      // Apply filtering results to DOM
      const matchCount = this._applyFiltersToDOM(
        analysisResult.products,
        validProductData.items,
        filterThreshold,
      );

      // Store results
      this.lastResults = {
        total: validProductData.items.length,
        matched: matchCount,
        filters,
      };

      document.documentElement.setAttribute("data-smart-filtered", "true");
      this.fetchingInProgress = false;

      return {
        success: true,
        matched: matchCount,
        total: validProductData.items.length,
      };
    } catch (error) {
      this.fetchingInProgress = false;
      console.error("Filter application error:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Extract valid product items from the page
   */
  _getValidProductItems(maxItems) {
    return Array.from(this.vendor.getProductItems())
      .map((item) => {
        const link = item.querySelector("a");
        if (!link) return null;

        // Let the vendor handle the URL extraction with its own logic
        const url = this.vendor.extractUrl(link);
        if (!url) return null;

        return { element: item, url };
      })
      .filter(Boolean)
      .slice(0, maxItems);
  }

  /**
   * Show loading indicators on product items
   */
  _showLoadingState(productItems) {
    productItems.forEach(({ element }) => {
      element.classList.add("smart-filter-loading");
    });
  }

  /**
   * Hide loading indicators on product items
   */
  _hideLoadingState(productItems) {
    productItems.forEach(({ element }) => {
      element.classList.remove("smart-filter-loading");
    });
  }

  /**
   * Fetch HTML for all products in parallel
   */
  async _fetchAllProductsHtml(productUrls) {
    return Promise.all(productUrls.map((url) => this._fetchHtml(url)));
  }

  /**
   * Get valid product data from results
   */
  _getValidProductData(productItems, productUrls, htmlContents) {
    const validUrls = [];
    const validHtmlContents = [];
    const validItems = [];

    htmlContents.forEach((html, index) => {
      if (html !== null) {
        validUrls.push(productUrls[index]);
        validHtmlContents.push(html);
        validItems.push(productItems[index]);
      } else {
        console.warn(`Failed to fetch HTML for ${productUrls[index]}`);
      }
    });

    return {
      valid: validUrls.length > 0,
      urls: validUrls,
      htmlContents: validHtmlContents,
      items: validItems,
    };
  }

  /**
   * Send products to backend for analysis
   */
  async _analyzeProducts(
    filters,
    productUrls,
    htmlContents,
    validProductItems,
    threshold,
  ) {
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: "analyzeProducts",
            filters,
            productUrls,
            htmlContents,
            threshold: threshold || 1,
          },
          (response) =>
            chrome.runtime.lastError
              ? reject(chrome.runtime.lastError)
              : resolve(response),
        );
      });

      if (!response?.success) {
        return { success: false, error: response?.error || "API error" };
      }

      this.filteredProducts = {
        products: response.products,
        items: validProductItems,
        filterThreshold: threshold,
        filters,
      };

      return { success: true, products: response.products };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Fetch HTML content for a single product
   */
  async _fetchHtml(url) {
    try {
      const startTime = performance.now();
      const result = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: "fetchHtml", url }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else if (!response.success) {
            console.warn(`Failed to fetch HTML for ${url}:`, response.error);
            resolve(null);
          } else {
            const duration = performance.now() - startTime;
            console.log(`Fetched HTML for ${url} in ${Math.round(duration)}ms`);
            resolve(response.html);
          }
        });
      });
      return result;
    } catch (error) {
      console.warn(`Error fetching HTML for ${url}:`, error);
      return null;
    }
  }

  /**
   * Apply filter results to DOM elements
   */
  _applyFiltersToDOM(products, productItems, threshold) {
    // Create lookup map by URL
    const productsByUrl = Object.fromEntries(
      products.map((product) => [product.url, product]),
    );

    let matchCount = 0;

    productItems.forEach(({ element, url }) => {
      const product = productsByUrl[url];
      if (!product) return;

      // Ensure element is positioned for badges
      if (window.getComputedStyle(element).position === "static") {
        element.style.position = "relative";
      }

      // Check if product meets threshold
      const matchingFilters = product.filters.filter((f) => f.value).length;
      const totalFilters = product.filters.length;
      const thresholdToApply =
        threshold === totalFilters
          ? totalFilters
          : Math.min(threshold, totalFilters);

      const meetsThreshold = matchingFilters >= thresholdToApply;

      // Mark as match or hide
      if (meetsThreshold) {
        matchCount++;
      } else {
        element.classList.add("smart-filter-hidden");
        this.hiddenElements.add(element);
      }

      // Add filter badges to the product
      this._addFilterBadges(element, product.filters);
    });

    return matchCount;
  }

  /**
   * Add filter badges to product elements
   */
  _addFilterBadges(element, filters) {
    if (!filters?.length) return;

    // Find container and clear existing badges
    const targetEl = this.vendor.findImageContainer(element);
    element.querySelectorAll(".badge-container").forEach((el) => el.remove());

    // Create badge container
    const badgeContainer = document.createElement("div");
    badgeContainer.className = "badge-container";

    // Add badges for each filter
    filters.forEach((filter) => {
      const badge = document.createElement("div");
      badge.className = `filter-badge ${!filter.value ? "filter-badge-negative" : ""}`;
      badge.textContent = `${filter.value ? "✓" : "✗"} ${filter.description}`;
      badgeContainer.appendChild(badge);
    });

    // Add badges to DOM
    targetEl.appendChild(badgeContainer);
    if (window.getComputedStyle(targetEl).position === "static") {
      targetEl.style.position = "relative";
    }
  }

  /**
   * Reset all filtering
   */
  resetFiltering() {
    this.filteredProducts = null;
    this.lastResults = { total: 0, matched: 0 };

    // Remove all UI indicators
    this.hiddenElements.forEach((el) => {
      el.classList.remove("smart-filter-hidden");
    });
    this.hiddenElements.clear();

    document.querySelectorAll(".badge-container").forEach((el) => el.remove());
    document.documentElement.removeAttribute("data-smart-filtered");
  }

  /**
   * Update threshold without re-fetching data
   */
  updateFilterThreshold(filterThreshold) {
    if (!this.filteredProducts) return { matched: 0, total: 0 };

    // Reset hidden state
    this.hiddenElements.forEach((el) => {
      el.classList.remove("smart-filter-hidden");
    });
    this.hiddenElements.clear();

    // Re-apply filters with new threshold
    const matchCount = this._applyFiltersToDOM(
      this.filteredProducts.products,
      this.filteredProducts.items,
      filterThreshold,
    );

    this.lastResults.matched = matchCount;
    return { matched: matchCount, total: this.lastResults.total };
  }
}
