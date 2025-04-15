// Core functionality for Smart Filter extension

class SmartFilterCore {
  constructor(vendor) {
    this.vendor = vendor;
    this.panelState = {
      isCollapsed: false,
      position: { x: 20, y: 20 },
    };
  }

  // Create and add filter UI
  init() {
    // Create panel
    const panel = document.createElement("div");
    panel.id = "smart-filter-panel";
    document.body.appendChild(panel);

    // Create panel header with drag handle
    const header = document.createElement("div");
    header.className = "panel-header";
    panel.appendChild(header);

    const title = document.createElement("h3");
    title.className = "panel-title";
    title.textContent = `Smart Filters - ${this.vendor.name}`;
    header.appendChild(title);

    const controls = document.createElement("div");
    controls.className = "panel-controls";
    header.appendChild(controls);

    const collapseBtn = document.createElement("button");
    collapseBtn.className = "panel-control-btn";
    collapseBtn.innerHTML = "−";
    collapseBtn.title = "Collapse panel";
    collapseBtn.onclick = () => this.togglePanelCollapse();
    controls.appendChild(collapseBtn);

    // Make panel draggable
    this.makeDraggable(panel, header);

    // Create panel body
    const body = document.createElement("div");
    body.className = "panel-body";
    panel.appendChild(body);

    // Create filter section
    const filterSection = document.createElement("div");
    filterSection.className = "panel-section";
    body.appendChild(filterSection);

    const filterSectionTitle = document.createElement("h4");
    filterSectionTitle.className = "panel-section-title";
    filterSectionTitle.textContent = "Filters";
    filterSection.appendChild(filterSectionTitle);

    // Add filter container
    const filterList = document.createElement("div");
    filterList.id = "filter-list";
    filterSection.appendChild(filterList);

    // Add default filters from vendor
    this.vendor.defaultFilters.forEach((filter) => {
      this.addFilterRow(filter, filterList);
    });

    // Add max items control
    const controlsSection = document.createElement("div");
    controlsSection.className = "panel-section";
    body.appendChild(controlsSection);

    const controlsRow = document.createElement("div");
    controlsRow.className = "panel-controls-row";
    controlsSection.appendChild(controlsRow);

    const maxItemsLabel = document.createElement("label");
    maxItemsLabel.className = "max-items-label";
    maxItemsLabel.textContent = "Max items:";
    maxItemsLabel.htmlFor = "max-items";
    controlsRow.appendChild(maxItemsLabel);

    const maxItemsInput = document.createElement("input");
    maxItemsInput.type = "number";
    maxItemsInput.id = "max-items";
    maxItemsInput.className = "max-items-input";
    maxItemsInput.min = "1";
    maxItemsInput.max = "50";
    maxItemsInput.value = "10";
    controlsRow.appendChild(maxItemsInput);

    // Add "Add Filter" button
    const addBtn = document.createElement("button");
    addBtn.textContent = "+ Add Filter";
    addBtn.className = "btn btn-primary";
    addBtn.onclick = () => this.addFilterRow("", filterList);
    controlsSection.appendChild(addBtn);

    // Add action buttons
    const actionsSection = document.createElement("div");
    actionsSection.className = "panel-section btn-row";
    body.appendChild(actionsSection);

    const applyBtn = document.createElement("button");
    applyBtn.id = "apply-btn";
    applyBtn.textContent = "Apply Filters";
    applyBtn.className = "btn btn-success";
    applyBtn.onclick = () => this.applyFilters();
    actionsSection.appendChild(applyBtn);

    const resetBtn = document.createElement("button");
    resetBtn.textContent = "Reset";
    resetBtn.className = "btn btn-neutral";
    resetBtn.onclick = () => this.resetFiltering();
    actionsSection.appendChild(resetBtn);
  }

  // Make an element draggable
  makeDraggable(element, handle) {
    let pos1 = 0,
      pos2 = 0,
      pos3 = 0,
      pos4 = 0;

    handle.onmousedown = dragMouseDown.bind(this);

    function dragMouseDown(e) {
      e.preventDefault();
      // Get the mouse cursor position at startup
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement.bind(this);
      // Call a function whenever the cursor moves
      document.onmousemove = elementDrag.bind(this);
    }

    function elementDrag(e) {
      e.preventDefault();
      // Calculate the new cursor position
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;

      // Set the element's new position
      const newTop = element.offsetTop - pos2;
      const newLeft = element.offsetLeft - pos1;

      // Ensure the panel stays within viewport bounds
      const maxLeft = window.innerWidth - element.offsetWidth;
      const maxTop = window.innerHeight - element.offsetHeight;

      element.style.top = `${Math.min(Math.max(0, newTop), maxTop)}px`;
      element.style.left = `${Math.min(Math.max(0, newLeft), maxLeft)}px`;

      // Update panel state
      this.panelState.position = {
        x: parseInt(element.style.left),
        y: parseInt(element.style.top),
      };
    }

    function closeDragElement() {
      // Stop moving when mouse button is released
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }

  // Toggle panel collapsed state
  togglePanelCollapse() {
    const panel = document.getElementById("smart-filter-panel");
    const collapseBtn = panel.querySelector(".panel-control-btn");

    this.panelState.isCollapsed = !this.panelState.isCollapsed;

    if (this.panelState.isCollapsed) {
      panel.classList.add("panel-collapsed");
      collapseBtn.innerHTML = "+";
      collapseBtn.title = "Expand panel";
    } else {
      panel.classList.remove("panel-collapsed");
      collapseBtn.innerHTML = "−";
      collapseBtn.title = "Collapse panel";
    }
  }

  // Create a new filter input row
  addFilterRow(value, container) {
    const row = document.createElement("div");
    row.className = "filter-row";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "filter-input";
    input.value = value;
    input.placeholder = value ? "" : "Enter filter criteria";

    const removeBtn = document.createElement("button");
    removeBtn.className = "filter-remove-btn";
    removeBtn.innerHTML = "×";
    removeBtn.title = "Remove filter";
    removeBtn.onclick = () => {
      row.style.opacity = "0";
      row.style.transform = "translateY(10px)";
      setTimeout(() => row.remove(), 300);
    };

    row.appendChild(input);
    row.appendChild(removeBtn);
    container.appendChild(row);

    return row;
  }

  // Apply filters to the page
  applyFilters() {
    const applyBtn = document.getElementById("apply-btn");
    applyBtn.textContent = "Filtering...";
    applyBtn.disabled = true;
    applyBtn.classList.add("btn-loading");

    // Get filters
    const filters = Array.from(document.querySelectorAll(".filter-input"))
      .map((input) => input.value.trim())
      .filter((text) => text !== "");

    if (filters.length === 0) {
      alert("Please add at least one filter");
      applyBtn.textContent = "Apply Filters";
      applyBtn.disabled = false;
      applyBtn.classList.remove("btn-loading");
      return;
    }

    // Reset previous filtering
    this.resetFiltering();

    // Get number of items to process
    const maxItems = parseInt(document.getElementById("max-items").value) || 10;

    // Get product items from the page using vendor-specific method
    const productItems = Array.from(this.vendor.getProductItems())
      .map((item) => {
        const link = item.querySelector("a");
        if (!link || !link.getAttribute("href")) return null;

        const fullUrl = this.vendor.extractUrl(link);
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
      applyBtn.classList.remove("btn-loading");
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
      (response) => this.handleFilterResults(response, productItems, applyBtn),
    );
  }

  // Handle API response
  handleFilterResults(response, productItems, applyBtn) {
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
          this.applyFilteringToItem(element, product);
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
    applyBtn.classList.remove("btn-loading");
  }

  // Apply filtering to a single product item
  applyFilteringToItem(element, product) {
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
      const existingBadges = element.querySelector(".badge-container");
      if (existingBadges) existingBadges.remove();

      // Create badge container
      const badgeContainer = document.createElement("div");
      badgeContainer.className = "badge-container";

      // Add badges for each filter
      product.filters.forEach((filter) => {
        const badge = document.createElement("div");
        badge.className = `filter-badge ${!filter.value ? "filter-badge-negative" : ""}`;

        const status = filter.value ? "✓" : "✗";
        badge.textContent = `${status} ${filter.description}`;

        badgeContainer.appendChild(badge);
      });

      // Find the best element to append the badges to using vendor config
      const targetEl = this.vendor.findImageContainer(element);
      targetEl.appendChild(badgeContainer);

      // Ensure the badge container is positioned correctly relative to its parent
      if (window.getComputedStyle(targetEl).position === "static") {
        targetEl.style.position = "relative";
      }
    }
  }

  // Reset all filtering
  resetFiltering() {
    this.vendor.getProductItems().forEach((item) => {
      item.style.opacity = "";
      item.style.filter = "";

      // Remove all smart filter elements
      item.querySelectorAll(".badge-container").forEach((el) => el.remove());
    });
  }
}
