// Content script for e-commerce filtering

(function () {
  // Only run on supported search pages - Fix URL pattern matching
  if (
    !window.location.hostname.includes("leboncoin.fr") ||
    !window.location.pathname.match(/\/(recherche|c)(\/|$)/)
  ) {
    console.log("Smart Filter: Not a supported page");
    return;
  }

  console.log("Smart Filter: Initializing on search page");

  // UI styling constants
  const STYLES = {
    panel: `
      position: fixed;
      top: 10px;
      right: 10px;
      background: white;
      padding: 15px;
      border-radius: 8px;
      box-shadow: 0 2px 15px rgba(0,0,0,0.2);
      z-index: 9999;
      width: 300px;
      font-family: Arial, sans-serif;
    `,
    title: "margin-top: 0; color: #333;",
    filterRow: "display: flex; margin-bottom: 10px; gap: 5px;",
    input: "flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;",
    removeBtn:
      "background: #f44336; color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer;",
    addBtn:
      "background: #4285f4; color: white; border: none; padding: 8px 12px; border-radius: 4px; margin-top: 10px; cursor: pointer;",
    applyBtn:
      "background: #0ca678; color: white; border: none; padding: 10px; border-radius: 4px; margin-top: 15px; width: 100%; cursor: pointer;",
    resetBtn:
      "background: none; color: #666; border: 1px solid #ccc; padding: 8px; border-radius: 4px; margin-top: 10px; width: 100%; cursor: pointer;",
    controls:
      "margin-top: 15px; display: flex; align-items: center; gap: 10px;",
    numInput:
      "width: 60px; padding: 8px; border: 1px solid #ddd; border-radius: 4px;",
    badge: `
      background-color: rgba(46,204,113,0.9);
      border-radius: 4px;
      padding: 3px 6px;
      font-size: 12px;
      color: white;
      box-shadow: 0 1px 2px rgba(0,0,0,0.2);
      max-width: 180px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-weight: bold;
      margin-bottom: 4px;
    `,
    badgeNegative: `
      background-color: rgba(231,76,60,0.9);
    `,
    badgeContainer: `
      position: absolute;
      top: 0;
      left: 0;
      width: auto;
      display: flex;
      flex-direction: column;
      padding: 5px;
      z-index: 1000;
    `,
  };

  // Create and add filter UI
  function init() {
    // Create panel
    const panel = document.createElement("div");
    panel.id = "smart-filter-panel";
    panel.style = STYLES.panel;

    // Add title
    const title = document.createElement("h3");
    title.textContent = "Smart Filters";
    title.style = STYLES.title;
    panel.appendChild(title);

    // Add filter container
    const filterList = document.createElement("div");
    filterList.id = "filter-list";
    panel.appendChild(filterList);

    // Add default filters
    addFilterRow("Is this a guitar?", filterList);
    addFilterRow("Is it in good condition?", filterList);

    // Add max items control
    const controls = document.createElement("div");
    controls.style = STYLES.controls;

    const maxItemsLabel = document.createElement("label");
    maxItemsLabel.textContent = "Max items:";
    maxItemsLabel.htmlFor = "max-items";

    const maxItemsInput = document.createElement("input");
    maxItemsInput.type = "number";
    maxItemsInput.id = "max-items";
    maxItemsInput.min = "1";
    maxItemsInput.max = "50";
    maxItemsInput.value = "10";
    maxItemsInput.style = STYLES.numInput;

    controls.appendChild(maxItemsLabel);
    controls.appendChild(maxItemsInput);
    panel.appendChild(controls);

    // Add control buttons
    const addBtn = document.createElement("button");
    addBtn.textContent = "+ Add Filter";
    addBtn.style = STYLES.addBtn;
    addBtn.onclick = () => addFilterRow("", filterList);
    panel.appendChild(addBtn);

    const applyBtn = document.createElement("button");
    applyBtn.id = "apply-btn";
    applyBtn.textContent = "Apply Filters";
    applyBtn.style = STYLES.applyBtn;
    applyBtn.onclick = applyFilters;
    panel.appendChild(applyBtn);

    const resetBtn = document.createElement("button");
    resetBtn.textContent = "Reset";
    resetBtn.style = STYLES.resetBtn;
    resetBtn.onclick = resetFiltering;
    panel.appendChild(resetBtn);

    // Add panel to page
    document.body.appendChild(panel);
  }

  // Create a new filter input row
  function addFilterRow(value, container) {
    const row = document.createElement("div");
    row.className = "filter-row";
    row.style = STYLES.filterRow;

    const input = document.createElement("input");
    input.type = "text";
    input.className = "filter-input";
    input.value = value;
    input.placeholder = value ? "" : "Enter filter criteria";
    input.style = STYLES.input;

    const removeBtn = document.createElement("button");
    removeBtn.innerHTML = "×";
    removeBtn.style = STYLES.removeBtn;
    removeBtn.onclick = () => row.remove();

    row.appendChild(input);
    row.appendChild(removeBtn);
    container.appendChild(row);

    return row;
  }

  // Apply filters to the page
  function applyFilters() {
    const applyBtn = document.getElementById("apply-btn");
    applyBtn.textContent = "Filtering...";
    applyBtn.disabled = true;

    // Get filters
    const filters = Array.from(document.querySelectorAll(".filter-input"))
      .map((input) => input.value.trim())
      .filter((text) => text !== "");

    if (filters.length === 0) {
      alert("Please add at least one filter");
      applyBtn.textContent = "Apply Filters";
      applyBtn.disabled = false;
      return;
    }

    // Reset previous filtering
    resetFiltering();

    // Get number of items to process
    const maxItems = parseInt(document.getElementById("max-items").value) || 10;

    // Get product items from the page
    const productItems = Array.from(
      document.querySelectorAll('article[data-test-id="ad"]'),
    )
      .map((item) => {
        const link = item.querySelector("a");
        if (!link || !link.getAttribute("href")) return null;

        const href = link.getAttribute("href");
        const fullUrl = href.startsWith("http")
          ? href
          : `https://${window.location.hostname}${href}`;

        return { element: item, url: fullUrl };
      })
      .filter(Boolean)
      .slice(0, maxItems);

    // Extract product URLs
    const productUrls = productItems.map((item) => item.url);

    // Nothing to filter
    if (productUrls.length === 0) {
      applyBtn.textContent = "Apply Filters";
      applyBtn.disabled = false;
      return;
    }

    // Call API via background script
    chrome.runtime.sendMessage(
      {
        action: "filterProducts",
        filters,
        productUrls,
        maxItems,
      },
      (response) => handleFilterResults(response, productItems, applyBtn),
    );
  }

  // Handle API response
  function handleFilterResults(response, productItems, applyBtn) {
    if (response && response.success) {
      // Create lookup for product data
      const productsByUrl = {};
      response.products.forEach((product) => {
        productsByUrl[product.url] = product;
      });

      // Apply results to items
      productItems.forEach(({ element, url }) => {
        const product = productsByUrl[url];
        if (product) {
          applyFilteringToItem(element, product);
        }
      });
    } else {
      const errorMessage = response?.error || "Unknown error";
      console.error("Filter error:", errorMessage);
      alert(`Error: ${errorMessage}`);
    }

    // Reset button state
    applyBtn.textContent = "Apply Filters";
    applyBtn.disabled = false;
  }

  // Apply filtering to a single product item
  function applyFilteringToItem(element, product) {
    // Ensure proper positioning for the container
    if (window.getComputedStyle(element).position === "static") {
      element.style.position = "relative";
    }

    // Apply styling based on filter results - only dim products that don't match
    if (!product.matches_filters) {
      element.style.opacity = "0.5";
      element.style.filter = "grayscale(70%)";
    }

    // Create badges directly in JS instead of calling the API
    if (product.filters && product.filters.length > 0) {
      // Remove any existing badges
      const existingBadges = element.querySelector(".smart-filter-results");
      if (existingBadges) existingBadges.remove();

      // Create badge container
      const badgeContainer = document.createElement("div");
      badgeContainer.className = "smart-filter-results";
      badgeContainer.style = STYLES.badgeContainer;

      // Add badges for each filter
      product.filters.forEach((filter) => {
        const badge = document.createElement("div");
        badge.className = "smart-filter-badge";
        badge.style = STYLES.badge + (filter.value ? "" : STYLES.badgeNegative);

        const status = filter.value ? "✓" : "✗";
        badge.textContent = `${status} ${filter.description}`;

        badgeContainer.appendChild(badge);
      });

      // Find the best element to append the badges to - target the image container if possible
      let targetEl = element.querySelector("img")?.closest("div") || element;
      targetEl.appendChild(badgeContainer);

      // Ensure the badge container is positioned correctly relative to its parent
      if (window.getComputedStyle(targetEl).position === "static") {
        targetEl.style.position = "relative";
      }
    }
  }

  // Reset all filtering
  function resetFiltering() {
    document.querySelectorAll('article[data-test-id="ad"]').forEach((item) => {
      item.style.opacity = "";
      item.style.filter = "";

      // Remove all smart filter elements
      item
        .querySelectorAll(".smart-filter-results")
        .forEach((el) => el.remove());
    });
  }

  // Initialize the UI
  // Wait for the DOM to be fully loaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
