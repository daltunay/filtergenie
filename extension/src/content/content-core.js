/**
 * FilterGenie Core - Handles item filtering logic
 * Simplified implementation
 */
class SmartFilterCore {
  constructor(platform) {
    this.platform = platform;
    this.lastResults = { total: 0, matched: 0 };
    this.filteredItems = null;
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

      let itemData;
      if (this.platform.pageType === "item") {
        itemData = await this._getItemPageData();
      } else {
        itemData = await this._getSearchPageData(maxItems);
      }

      if (!itemData.success) {
        return itemData;
      }

      const analysisResult = await this._analyzeItems(
        filters,
        itemData.urls,
        itemData.htmlContents,
        filterThreshold,
      );

      if (!analysisResult?.success) {
        return { success: false, error: analysisResult?.error || "API error" };
      }

      let matchCount = 0;
      if (this.platform.pageType === "item") {
        const item = analysisResult.items[0];
        if (item) {
          const targetContainer =
            document.querySelector("main") || document.body;
          this._addFilterBadges(targetContainer, item.filters);
          matchCount = item.matches_all_filters() ? 1 : 0;
        }
      } else {
        matchCount = this._applyFiltersToDOM(
          analysisResult.items,
          itemData.items,
          filterThreshold,
        );
      }

      const total = itemData.items?.length || 1;

      this.lastResults = {
        total: total,
        matched: matchCount,
        filters,
      };

      document.documentElement.setAttribute("data-smart-filtered", "true");

      this.filteredItems = {
        items: analysisResult.items,
        items: itemData.items,
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

  async _getItemPageData() {
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
    const itemItems = this._getValidItemItems(maxItems);

    if (!itemItems.length) {
      return { success: false, error: "No items found" };
    }

    const itemUrls = itemItems.map((item) => item.url);
    this._toggleLoadingState(itemItems, true);

    try {
      const htmlContents = await Promise.all(
        itemUrls.map((url) => this._fetchHtml(url)),
      );

      const validItemData = this._getValidItemData(
        itemItems,
        itemUrls,
        htmlContents,
      );

      if (!validItemData.valid) {
        return { success: false, error: "Failed to fetch HTML content" };
      }

      return {
        success: true,
        urls: validItemData.urls,
        htmlContents: validItemData.htmlContents,
        items: validItemData.items,
      };
    } finally {
      this._toggleLoadingState(itemItems, false);
    }
  }

  async _analyzeItems(filters, urls, htmlContents, threshold) {
    return await chrome.runtime.sendMessage({
      action: "analyzeItems",
      filters,
      itemUrls: urls,
      htmlContents: htmlContents,
      threshold: threshold || 1,
    });
  }

  _getValidItemItems(maxItems) {
    return Array.from(this.platform.getItemItems())
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

  _toggleLoadingState(itemItems, isLoading) {
    itemItems.forEach(({ element }) => {
      element.classList.toggle("smart-filter-loading", isLoading);
    });
  }

  _getValidItemData(itemItems, itemUrls, htmlContents) {
    const validData = itemItems
      .map((item, index) =>
        htmlContents[index]
          ? { item, url: itemUrls[index], html: htmlContents[index] }
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

  _applyFiltersToDOM(items, itemItems, threshold) {
    const itemsByUrl = Object.fromEntries(
      items.map((item) => [item.url, item]),
    );

    let matchCount = 0;

    itemItems.forEach(({ element, url }) => {
      const item = itemsByUrl[url];
      if (!item) return;

      if (window.getComputedStyle(element).position === "static") {
        element.style.position = "relative";
      }

      const matchingFilters = item.filters.filter((f) => f.value).length;
      const totalFilters = item.filters.length;
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

      this._addFilterBadges(element, item.filters);
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
    this.filteredItems = null;
    this.lastResults = { total: 0, matched: 0 };

    this.hiddenElements.forEach((el) =>
      el.classList.remove("smart-filter-hidden"),
    );
    this.hiddenElements.clear();

    document.querySelectorAll(".badge-container").forEach((el) => el.remove());
    document.documentElement.removeAttribute("data-smart-filtered");
  }

  updateFilterThreshold(filterThreshold) {
    if (!this.filteredItems) return { matched: 0, total: 0 };

    this.hiddenElements.forEach((el) =>
      el.classList.remove("smart-filter-hidden"),
    );
    this.hiddenElements.clear();

    const matchCount = this._applyFiltersToDOM(
      this.filteredItems.items,
      this.filteredItems.items,
      filterThreshold,
    );

    this.lastResults.matched = matchCount;
    return { matched: matchCount, total: this.lastResults.total };
  }
}
