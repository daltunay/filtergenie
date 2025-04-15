/**
 * Smart E-commerce Filter - Core Functionality
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
    const existingStyle = document.getElementById(styleId);
    if (existingStyle) existingStyle.remove();

    document.head.appendChild(
      Object.assign(document.createElement("style"), {
        id: styleId,
        textContent: `
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
      `,
      }),
    );
  }

  async applyFilters(filters, maxItems, hideNonMatching) {
    this.resetFiltering();

    const productItems = Array.from(this.vendor.getProductItems())
      .map((item) => {
        const link = item.querySelector("a");
        if (!link || !link.getAttribute("href")) return null;
        return { element: item, url: this.vendor.extractUrl(link) };
      })
      .filter(Boolean)
      .slice(0, maxItems);

    if (productItems.length === 0) {
      return { success: false, error: "No products found" };
    }

    try {
      const response = await this._callFilterAPI(
        filters,
        productItems.map((item) => item.url),
        maxItems,
      );

      if (response?.success) {
        this.filteredProducts = {
          products: response.products,
          items: productItems,
          hideNonMatching,
          filters,
        };

        const productsByUrl = Object.fromEntries(
          response.products.map((product) => [product.url, product]),
        );

        let matchCount = 0;

        productItems.forEach(({ element, url }) => {
          const product = productsByUrl[url];
          if (product) {
            this._applyFilteringToItem(element, product, hideNonMatching);
            if (product.matches_filters) matchCount++;
          }
        });

        this.lastResults = {
          total: productItems.length,
          matched: matchCount,
          filters,
        };
        document.documentElement.setAttribute("data-smart-filtered", "true");

        return {
          success: true,
          matched: matchCount,
          total: productItems.length,
        };
      } else {
        return { success: false, error: response?.error || "Unknown error" };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  resetFiltering() {
    this.filteredProducts = null;
    this.lastResults = { total: 0, matched: 0 };

    this.hiddenElements.forEach((element) => this._showElement(element));
    this.hiddenElements.clear();

    this.dimmedElements.forEach((element) => this._undimElement(element));
    this.dimmedElements.clear();

    document.querySelectorAll(".badge-container").forEach((el) => el.remove());
    document.documentElement.removeAttribute("data-smart-filtered");
  }

  _applyFilteringToItem(element, product, hideNonMatching) {
    if (window.getComputedStyle(element).position === "static") {
      element.style.position = "relative";
    }

    if (!product.matches_filters) {
      if (hideNonMatching) {
        this._hideElement(element);
        this.hiddenElements.add(element);
      } else {
        this._dimElement(element);
        this.dimmedElements.add(element);
      }
    }

    if (product.filters?.length > 0) {
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

  _hideElement(element) {
    element.classList.add("smart-filter-hidden");
    element.setAttribute("aria-hidden", "true");
  }

  _showElement(element) {
    element.classList.remove("smart-filter-hidden");
    element.removeAttribute("aria-hidden");
  }

  _dimElement(element) {
    element.classList.add("smart-filter-dimmed");
  }

  _undimElement(element) {
    element.classList.remove("smart-filter-dimmed");
  }

  updateHideMode(hideNonMatching) {
    if (!this.filteredProducts) return;

    this.filteredProducts.hideNonMatching = hideNonMatching;

    this.hiddenElements.forEach((element) => this._showElement(element));
    this.hiddenElements.clear();

    this.dimmedElements.forEach((element) => this._undimElement(element));
    this.dimmedElements.clear();

    const productsByUrl = Object.fromEntries(
      this.filteredProducts.products.map((product) => [product.url, product]),
    );

    this.filteredProducts.items.forEach(({ element, url }) => {
      const product = productsByUrl[url];
      if (product && !product.matches_filters) {
        if (hideNonMatching) {
          this._hideElement(element);
          this.hiddenElements.add(element);
        } else {
          this._dimElement(element);
          this.dimmedElements.add(element);
        }
      }
    });
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
