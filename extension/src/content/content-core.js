/**
 * SmartFilter Core - Handles product filtering logic
 * Optimized for RESTful HTML-based approach
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
    if (this.fetchingInProgress) {
      return { success: false, error: "Filter operation already in progress" };
    }

    try {
      this.fetchingInProgress = true;
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
        this.fetchingInProgress = false;
        return { success: false, error: "No products found" };
      }

      console.log(`Filtering ${productItems.length} products`);

      // Create a map of product URLs to track progress
      const productUrls = productItems.map((item) => item.url);

      // Use Promise.all for parallel fetching
      const htmlContentsPromise = Promise.all(
        productUrls.map((url) => this._fetchHtml(url)),
      );

      // Show loading UI feedback
      productItems.forEach(({ element }) => {
        element.classList.add("smart-filter-loading");
      });

      // Wait for all HTML content to be fetched
      const htmlContents = await htmlContentsPromise;

      // Filter out any failed fetches and create valid products array
      const validProducts = [];
      const validHtmlContents = [];
      const validProductItems = [];

      htmlContents.forEach((html, index) => {
        if (html !== null) {
          validProducts.push(productUrls[index]);
          validHtmlContents.push(html);
          validProductItems.push(productItems[index]);
        } else {
          console.warn(`Failed to fetch HTML for ${productUrls[index]}`);
        }
      });

      if (validProducts.length === 0) {
        productItems.forEach(({ element }) => {
          element.classList.remove("smart-filter-loading");
        });
        this.fetchingInProgress = false;
        return { success: false, error: "Failed to fetch HTML content" };
      }

      // Send all HTML content to the backend for analysis
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: "analyzeProducts",
            filters,
            productUrls: validProducts,
            htmlContents: validHtmlContents,
            threshold: filterThreshold,
          },
          (response) =>
            chrome.runtime.lastError
              ? reject(chrome.runtime.lastError)
              : resolve(response),
        );
      });

      if (!response?.success) {
        productItems.forEach(({ element }) => {
          element.classList.remove("smart-filter-loading");
        });
        this.fetchingInProgress = false;
        return { success: false, error: response?.error || "API error" };
      }

      // Remove loading indicators
      productItems.forEach(({ element }) => {
        element.classList.remove("smart-filter-loading");
      });

      this.filteredProducts = {
        products: response.products,
        items: validProductItems,
        filterThreshold,
        filters,
      };

      const matchCount = this._applyFiltersToDOM(
        response.products,
        validProductItems,
        filterThreshold,
      );

      this.lastResults = {
        total: validProductItems.length,
        matched: matchCount,
        filters,
      };

      document.documentElement.setAttribute("data-smart-filtered", "true");
      this.fetchingInProgress = false;
      return {
        success: true,
        matched: matchCount,
        total: validProductItems.length,
      };
    } catch (error) {
      this.fetchingInProgress = false;
      console.error("Filter application error:", error);
      return { success: false, error: error.message };
    }
  }

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
}
