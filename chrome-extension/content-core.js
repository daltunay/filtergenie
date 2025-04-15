// Core functionality for Smart Filter extension

class SmartFilterCore {
  constructor(vendor) {
    this.vendor = vendor;
    this.panelState = {
      isCollapsed: false,
      position: { x: 20, y: 20 },
    };
    this.filterExamples = [
      "Is this in excellent condition?",
      "Does this look authentic?",
      "Is this a good deal?",
      "Is this suitable for beginners?",
      "Does this have all parts included?",
      "Has this been used less than 6 months?",
      "Is this from a pet-free home?",
    ];
    this.lastResults = {
      total: 0,
      matched: 0,
    };
    this.filteredProducts = null; // Store the filtered products for reuse
  }

  // Create and add filter UI
  init() {
    // Create panel
    const panel = document.createElement("div");
    panel.id = "smart-filter-panel";
    document.body.appendChild(panel);

    // Try to extract colors from favicon for theming
    this.extractThemeFromFavicon();

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

    // Add social links to the panel
    const socialLinks = document.createElement("div");
    socialLinks.className = "social-links";

    // Add GitHub link
    const githubLink = document.createElement("a");
    githubLink.href = "https://github.com/daltunay/ecommerce-smart-filtering";
    githubLink.target = "_blank";
    githubLink.className = "social-link github-link";
    githubLink.title = "View on GitHub";

    const githubLogo = document.createElement("img");
    githubLogo.src = chrome.runtime.getURL("images/github.png");
    githubLogo.className = "social-logo";
    githubLogo.alt = "GitHub";

    githubLink.appendChild(githubLogo);
    socialLinks.appendChild(githubLink);

    // Add LinkedIn link
    const linkedinLink = document.createElement("a");
    linkedinLink.href = "https://www.linkedin.com/in/daltunay/";
    linkedinLink.target = "_blank";
    linkedinLink.className = "social-link linkedin-link";
    linkedinLink.title = "Connect on LinkedIn";

    const linkedinLogo = document.createElement("img");
    linkedinLogo.src = chrome.runtime.getURL("images/linkedin.png");
    linkedinLogo.className = "social-logo";
    linkedinLogo.alt = "LinkedIn";

    linkedinLink.appendChild(linkedinLogo);
    socialLinks.appendChild(linkedinLink);

    const collapseBtn = document.createElement("button");
    collapseBtn.className = "panel-control-btn";
    collapseBtn.innerHTML = "−";
    collapseBtn.title = "Collapse panel";
    collapseBtn.onclick = () => this.togglePanelCollapse();
    controls.appendChild(collapseBtn);

    // Make panel draggable with simpler implementation
    this.makeDraggableBetter(panel, header);

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

    // Create tooltip for filter examples
    const tooltipContainer = document.createElement("div");
    tooltipContainer.className = "tooltip-container";

    const tooltipIcon = document.createElement("button");
    tooltipIcon.className = "tooltip-icon";
    tooltipIcon.textContent = "?";
    tooltipIcon.setAttribute("aria-label", "Show filter examples");
    tooltipIcon.setAttribute("type", "button");

    const tooltipContent = document.createElement("div");
    tooltipContent.className = "tooltip-content";

    // Set up improved tooltip positioning that can exceed the popup
    tooltipIcon.addEventListener("mouseenter", (e) => {
      this.positionFixedTooltip(tooltipIcon, tooltipContent);
    });

    tooltipIcon.addEventListener("focus", (e) => {
      this.positionFixedTooltip(tooltipIcon, tooltipContent);
    });

    const tooltipTitle = document.createElement("div");
    tooltipTitle.className = "tooltip-title";
    tooltipTitle.textContent = "Example filters:";
    tooltipContent.appendChild(tooltipTitle);

    // Add examples to tooltip
    this.filterExamples.forEach((example) => {
      const exampleItem = document.createElement("div");
      exampleItem.className = "example-item";
      exampleItem.textContent = example;
      exampleItem.onclick = () => {
        this.addFilterRow(example, filterList);
        // Hide tooltip after selection for better UX
        tooltipContent.style.visibility = "hidden";
        setTimeout(() => {
          tooltipContent.style.visibility = "";
        }, 300);
      };
      tooltipContent.appendChild(exampleItem);
    });

    tooltipContainer.appendChild(tooltipIcon);
    tooltipContainer.appendChild(tooltipContent);
    filterSectionTitle.appendChild(tooltipContainer);

    // Add filter container
    const filterList = document.createElement("div");
    filterList.id = "filter-list";

    filterSection.appendChild(filterSectionTitle);
    filterSection.appendChild(filterList);

    // Add default empty filter
    this.addFilterRow("", filterList);

    // Add "Add Filter" button in the title
    const addFilterBtn = document.createElement("button");
    addFilterBtn.className = "panel-control-btn";
    addFilterBtn.innerHTML = "+";
    addFilterBtn.title = "Add filter";
    addFilterBtn.onclick = () => this.addFilterRow("", filterList);
    filterSectionTitle.appendChild(addFilterBtn);

    // Add a more prominent "Add Filter" button below the filters
    const addFilterButtonRow = document.createElement("div");
    addFilterButtonRow.className = "filter-button-row";

    const newFilterBtn = document.createElement("button");
    newFilterBtn.className = "btn btn-primary add-filter-btn";
    newFilterBtn.innerHTML = `<svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>Add New Filter`;
    newFilterBtn.onclick = () => this.addFilterRow("", filterList);

    addFilterButtonRow.appendChild(newFilterBtn);
    filterSection.appendChild(addFilterButtonRow);

    // Add controls section
    const controlsSection = document.createElement("div");
    controlsSection.className = "panel-section";
    body.appendChild(controlsSection);

    const controlsSectionTitle = document.createElement("h4");
    controlsSectionTitle.className = "panel-section-title";
    controlsSectionTitle.textContent = "Settings";
    controlsSection.appendChild(controlsSectionTitle);

    // Update max items input with spinner controls and validation
    const maxItemsContainer = document.createElement("div");
    maxItemsContainer.className = "max-items-container";
    controlsSection.appendChild(maxItemsContainer);

    const maxItemsLabel = document.createElement("label");
    maxItemsLabel.className = "max-items-label";
    maxItemsLabel.textContent = "Maximum items to filter:";
    maxItemsLabel.htmlFor = "max-items";
    maxItemsContainer.appendChild(maxItemsLabel);

    // Create container for number input and controls
    const numberInputContainer = document.createElement("div");
    numberInputContainer.className = "number-input-container";

    const maxItemsInput = document.createElement("input");
    maxItemsInput.type = "number";
    maxItemsInput.id = "max-items";
    maxItemsInput.className = "max-items-input";
    maxItemsInput.min = "1";
    maxItemsInput.max = "10"; // Keep max at 10 to prevent exceeding API quotas
    maxItemsInput.value = "5";

    // Add input validation to prevent exceeding quota
    maxItemsInput.addEventListener("input", () => {
      const maxAllowed = parseInt(maxItemsInput.max);
      const currentValue = parseInt(maxItemsInput.value);

      if (isNaN(currentValue)) {
        maxItemsInput.value = maxItemsInput.min;
      } else if (currentValue > maxAllowed) {
        maxItemsInput.value = maxAllowed;
      }
    });

    numberInputContainer.appendChild(maxItemsInput);

    // Add spinner controls
    const numberControls = document.createElement("div");
    numberControls.className = "number-controls";

    const upButton = document.createElement("button");
    upButton.className = "spinner-button";
    upButton.textContent = "▲";
    upButton.type = "button";
    upButton.onclick = () => {
      const currentValue = parseInt(maxItemsInput.value) || 5;
      maxItemsInput.value = Math.min(
        parseInt(maxItemsInput.max),
        currentValue + 1,
      );
    };

    const downButton = document.createElement("button");
    downButton.className = "spinner-button";
    downButton.textContent = "▼";
    downButton.type = "button";
    downButton.onclick = () => {
      const currentValue = parseInt(maxItemsInput.value) || 5;
      maxItemsInput.value = Math.max(
        parseInt(maxItemsInput.min),
        currentValue - 1,
      );
    };

    numberControls.appendChild(upButton);
    numberControls.appendChild(downButton);
    numberInputContainer.appendChild(numberControls);

    maxItemsContainer.appendChild(numberInputContainer);

    // Add hide non-matching option
    const hideNonMatchingContainer = document.createElement("div");
    hideNonMatchingContainer.className = "checkbox-container";
    controlsSection.appendChild(hideNonMatchingContainer);

    const hideNonMatchingLabel = document.createElement("label");
    hideNonMatchingLabel.className = "checkbox-label";
    hideNonMatchingLabel.textContent = "Hide non-matching items";
    hideNonMatchingLabel.htmlFor = "hide-non-matching";
    hideNonMatchingContainer.appendChild(hideNonMatchingLabel);

    const toggleSwitch = document.createElement("label");
    toggleSwitch.className = "toggle-switch";

    const hideNonMatchingCheckbox = document.createElement("input");
    hideNonMatchingCheckbox.type = "checkbox";
    hideNonMatchingCheckbox.id = "hide-non-matching";

    // Add event listener to immediately apply changes when toggled
    hideNonMatchingCheckbox.addEventListener("change", () => {
      // Only reapply if we have previous results
      if (this.filteredProducts) {
        this.reapplyFiltering();
      }
    });

    const slider = document.createElement("span");
    slider.className = "slider";

    toggleSwitch.appendChild(hideNonMatchingCheckbox);
    toggleSwitch.appendChild(slider);
    hideNonMatchingContainer.appendChild(toggleSwitch);

    // Add action buttons
    const actionsSection = document.createElement("div");
    actionsSection.className = "panel-section btn-row";
    body.appendChild(actionsSection);

    const applyBtn = document.createElement("button");
    applyBtn.id = "apply-btn";
    applyBtn.innerHTML = `<svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>Apply Filters`;
    applyBtn.className = "btn btn-success";
    applyBtn.onclick = () => this.applyFilters();
    actionsSection.appendChild(applyBtn);

    const resetBtn = document.createElement("button");
    resetBtn.innerHTML = `<svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>Reset`;
    resetBtn.className = "btn btn-neutral";
    resetBtn.onclick = () => this.resetFiltering();
    actionsSection.appendChild(resetBtn);

    // Add results counter
    const resultsCounter = document.createElement("div");
    resultsCounter.id = "results-counter";
    resultsCounter.className = "results-counter";
    resultsCounter.innerHTML = "<span>No filters applied yet</span>";
    actionsSection.appendChild(resultsCounter);

    // Add footer with social links
    const footer = document.createElement("div");
    footer.className = "footer";

    const footerText = document.createElement("span");
    footerText.textContent = "Made by Daniel Altunay";

    footer.appendChild(footerText);
    footer.appendChild(socialLinks);
    body.appendChild(footer);
  }

  // Improved tooltip positioning that works with fixed position
  positionFixedTooltip(iconElement, tooltipElement) {
    // Reset classes
    tooltipElement.classList.remove("position-left", "position-top", "position-bottom");

    // Get icon's position in the viewport
    const iconRect = iconElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // We need to briefly display the tooltip to measure it
    tooltipElement.style.visibility = "hidden";
    tooltipElement.style.display = "block";
    tooltipElement.style.opacity = "0";
    const tooltipRect = tooltipElement.getBoundingClientRect();

    // Calculate available space in different directions
    const spaceRight = viewportWidth - iconRect.right - 10;
    const spaceLeft = iconRect.left - 10;
    const spaceBottom = viewportHeight - iconRect.bottom - 10;
    const spaceTop = iconRect.top - 10;

    // Reset styling
    tooltipElement.style.left = "";
    tooltipElement.style.right = "";
    tooltipElement.style.top = "";
    tooltipElement.style.bottom = "";
    tooltipElement.style.transform = "";

    // Position based on available space
    if (spaceRight >= tooltipRect.width) {
      // Position to the right (default)
      tooltipElement.style.left = `${iconRect.right + 10}px`;
      tooltipElement.style.top = `${iconRect.top + (iconRect.height / 2)}px`;
      tooltipElement.style.transform = "translateY(-50%)";
    } else if (spaceLeft >= tooltipRect.width) {
      // Position to the left
      tooltipElement.style.right = `${viewportWidth - iconRect.left + 10}px`;
      tooltipElement.style.top = `${iconRect.top + (iconRect.height / 2)}px`;
      tooltipElement.style.transform = "translateY(-50%)";
      tooltipElement.classList.add("position-left");
    } else if (spaceBottom >= tooltipRect.height) {
      // Position to the bottom
      tooltipElement.style.left = `${iconRect.left + (iconRect.width / 2)}px`;
      tooltipElement.style.top = `${iconRect.bottom + 10}px`;
      tooltipElement.style.transform = "translateX(-50%)";
      tooltipElement.classList.add("position-bottom");
    } else {
      // Position to the top
      tooltipElement.style.left = `${iconRect.left + (iconRect.width / 2)}px`;
      tooltipElement.style.bottom = `${viewportHeight - iconRect.top + 10}px`;
      tooltipElement.style.transform = "translateX(-50%)";
      tooltipElement.classList.add("position-top");
    }

    // Restore visibility settings
    tooltipElement.style.visibility = "";
    tooltipElement.style.display = "";
    tooltipElement.style.opacity = "";
  }

  // Remove the old positioning method that was being used previously
  positionTooltip(container, tooltipElement) {
    // This method is now replaced by positionFixedTooltip
    this.positionFixedTooltip(container.querySelector('.tooltip-icon'), tooltipElement);
  }

  // Function to extract theme colors from website favicon
  extractThemeFromFavicon() {
    try {
      // First try to get the favicon from the page
      let faviconUrl = null;

      // Try various favicon sources in order of preference
      const faviconSources = [
        // Chrome/Firefox tab icon - most reliable source
        document.querySelector(
          'link[rel="icon"][sizes="32x32"], link[rel="icon"][sizes="48x48"], link[rel="shortcut icon"][sizes="32x32"]',
        ),
        // Apple touch icon - often higher quality
        document.querySelector(
          'link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]',
        ),
        // Any icon as fallback
        document.querySelector('link[rel="icon"], link[rel="shortcut icon"]'),
      ];

      // Find the first valid favicon source
      for (const source of faviconSources) {
        if (source && source.href) {
          faviconUrl = source.href;
          break;
        }
      }

      // If no favicon found in links, try a default location
      if (!faviconUrl) {
        // Try the default favicon location
        const baseUrl = window.location.origin;
        faviconUrl = `${baseUrl}/favicon.ico`;
      }

      if (!faviconUrl) return;

      // Create an image and load the favicon
      const img = new Image();
      img.crossOrigin = "Anonymous";

      img.onload = () => {
        // Create canvas to analyze colors
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = img.width;
        canvas.height = img.height;

        // Draw the image
        ctx.drawImage(img, 0, 0);

        try {
          // Get image data
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;

          // Skip if the image is too small
          if (canvas.width < 8 || canvas.height < 8) {
            return;
          }

          // Collect all non-transparent colors
          const colors = [];
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            // Skip transparent and near-white/black pixels
            if (a < 200) continue;
            if (r > 240 && g > 240 && b > 240) continue; // Skip near-white
            if (r < 15 && g < 15 && b < 15) continue; // Skip near-black

            // Add color with weight based on saturation and non-grayness
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const saturation = max === 0 ? 0 : (max - min) / max;
            const nonGrayness =
              Math.abs(r - g) + Math.abs(r - b) + Math.abs(g - b);

            colors.push({
              r,
              g,
              b,
              // Give more weight to saturated and non-gray colors
              weight: saturation * 2 + nonGrayness / 100,
            });
          }

          // No valid colors found
          if (colors.length === 0) return;

          // Sort by weight to find the most prominent color
          colors.sort((a, b) => b.weight - a.weight);

          // Create a comprehensive palette from the icon colors
          const palette = this.createEnhancedPalette(colors);

          // Calculate brightness to determine text color for primary color
          const primaryBrightness = this.calculateBrightness(palette.primary);
          const textColor = primaryBrightness > 128 ? "#111827" : "white";

          // Apply the full color palette to CSS variables
          document.documentElement.style.setProperty(
            "--panel-header-bg",
            palette.primaryRgb,
          );
          document.documentElement.style.setProperty(
            "--panel-header-text",
            textColor,
          );
          document.documentElement.style.setProperty(
            "--primary-color",
            palette.primaryRgb,
          );
          document.documentElement.style.setProperty(
            "--primary-hover",
            palette.primaryHoverRgb,
          );
          document.documentElement.style.setProperty(
            "--accent-color",
            palette.accentRgb,
          );
          document.documentElement.style.setProperty(
            "--accent-hover",
            palette.accentHoverRgb,
          );
          document.documentElement.style.setProperty(
            "--neutral-dark",
            palette.neutralDarkRgb,
          );
          document.documentElement.style.setProperty(
            "--neutral-color",
            palette.neutralRgb,
          );
          document.documentElement.style.setProperty(
            "--focus-ring",
            palette.focusRingRgba,
          );

          // Also set success/danger colors if there are enough colors in palette
          if (palette.successRgb) {
            document.documentElement.style.setProperty(
              "--success-color",
              palette.successRgb,
            );
          }
        } catch (e) {
          console.error("Error analyzing favicon colors:", e);
        }
      };

      // Handle errors
      img.onerror = () => {
        console.log("Failed to load favicon for color analysis");
      };

      // Start loading the image
      img.src = faviconUrl;
    } catch (error) {
      console.error("Error in favicon theme extraction:", error);
    }
  }

  // Create an enhanced color palette from extracted colors
  createEnhancedPalette(colors) {
    // Start with a basic palette from the most prominent colors
    const distinctColors = this.createPalette(colors);

    // Create a more comprehensive color palette
    const primary = distinctColors[0];
    const accent =
      distinctColors.length > 1
        ? distinctColors[1]
        : this.adjustColorObj(primary, 30);

    // Create neutral colors based on primary (but desaturated)
    const desaturatedBase = this.desaturateColor(primary, 0.7);
    const neutral = this.adjustColorObj(desaturatedBase, -10);
    const neutralDark = this.adjustColorObj(desaturatedBase, -30);

    // Create success/danger colors if we have enough distinct colors
    const success =
      distinctColors.length > 2
        ? distinctColors[2]
        : this.createSuccessColor(primary);

    // Create RGB strings for all colors
    const primaryRgb = `rgb(${primary.r}, ${primary.g}, ${primary.b})`;
    const primaryHoverRgb = this.adjustColor(primary, -15);
    const accentRgb = `rgb(${accent.r}, ${accent.g}, ${accent.b})`;
    const accentHoverRgb = this.adjustColor(accent, -15);
    const neutralRgb = `rgb(${neutral.r}, ${neutral.g}, ${neutral.b})`;
    const neutralDarkRgb = `rgb(${neutralDark.r}, ${neutralDark.g}, ${neutralDark.b})`;
    const successRgb = `rgb(${success.r}, ${success.g}, ${success.b})`;
    const focusRingRgba = `rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.2)`;

    return {
      primary,
      accent,
      neutral,
      neutralDark,
      success,
      primaryRgb,
      primaryHoverRgb,
      accentRgb,
      accentHoverRgb,
      neutralRgb,
      neutralDarkRgb,
      successRgb,
      focusRingRgba,
    };
  }

  // Create a success color (green-like) based on a color
  createSuccessColor(color) {
    // Start with a green base and adjust based on the source color's brightness
    const brightness = this.calculateBrightness(color);
    const baseGreen = { r: 16, g: 185, b: 129 }; // #10b981

    if (brightness > 170) {
      return this.adjustColorObj(baseGreen, 20); // Lighter green for bright primary
    } else if (brightness < 80) {
      return this.adjustColorObj(baseGreen, -20); // Darker green for dark primary
    }
    return baseGreen;
  }

  // Desaturate a color
  desaturateColor(color, amount) {
    const gray = (color.r + color.g + color.b) / 3;
    return {
      r: Math.round(color.r * amount + gray * (1 - amount)),
      g: Math.round(color.g * amount + gray * (1 - amount)),
      b: Math.round(color.b * amount + gray * (1 - amount)),
      weight: color.weight,
    };
  }

  // Calculate color brightness
  calculateBrightness(color) {
    return (color.r * 299 + color.g * 587 + color.b * 114) / 1000;
  }

  // Adjust a color object by a percentage (positive = lighten, negative = darken)
  adjustColorObj(color, percent) {
    const factor = 1 + percent / 100;
    return {
      r: Math.min(255, Math.max(0, Math.round(color.r * factor))),
      g: Math.min(255, Math.max(0, Math.round(color.g * factor))),
      b: Math.min(255, Math.max(0, Math.round(color.b * factor))),
      weight: color.weight,
    };
  }

  // Create a palette of distinct colors from the extracted colors
  createPalette(colors) {
    const palette = [];
    const minimumDistance = 50; // Minimum RGB distance to consider a color distinct

    // Add the first color (most prominent)
    if (colors.length > 0) {
      palette.push(colors[0]);
    }

    // Find distinct colors
    for (let i = 1; i < colors.length && palette.length < 3; i++) {
      const color = colors[i];
      let isDistinct = true;

      // Check if this color is sufficiently different from existing palette colors
      for (const paletteColor of palette) {
        const distance = this.colorDistance(color, paletteColor);
        if (distance < minimumDistance) {
          isDistinct = false;
          break;
        }
      }

      if (isDistinct) {
        palette.push(color);
      }
    }

    return palette;
  }

  // Calculate distance between two colors in RGB space
  colorDistance(color1, color2) {
    return Math.sqrt(
      Math.pow(color1.r - color2.r, 2) +
        Math.pow(color1.g - color2.g, 2) +
        Math.pow(color1.b - color2.b, 2),
    );
  }

  // Adjust a color by a percentage (positive = lighten, negative = darken)
  adjustColor(color, percent) {
    const factor = 1 + percent / 100;
    const r = Math.min(255, Math.max(0, Math.round(color.r * factor)));
    const g = Math.min(255, Math.max(0, Math.round(color.g * factor)));
    const b = Math.min(255, Math.max(0, Math.round(color.b * factor)));

    return `rgb(${r}, ${g}, ${b})`;
  }

  // Simplified draggable implementation
  makeDraggableBetter(element, handle) {
    let isDragging = false;
    let startX, startY;
    let startLeft, startTop;

    handle.addEventListener("mousedown", startDrag);
    handle.addEventListener("touchstart", startDrag, { passive: false });

    function startDrag(e) {
      e.preventDefault();
      isDragging = true;

      // Get starting positions
      startX = e.type === "touchstart" ? e.touches[0].clientX : e.clientX;
      startY = e.type === "touchstart" ? e.touches[0].clientY : e.clientY;

      // Get current panel position
      const rect = element.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;

      // Apply listeners
      document.addEventListener("mousemove", doDrag);
      document.addEventListener("touchmove", doDrag, { passive: false });
      document.addEventListener("mouseup", stopDrag);
      document.addEventListener("touchend", stopDrag);

      // Add dragging class for visual feedback
      element.classList.add("dragging");
    }

    function doDrag(e) {
      if (!isDragging) return;
      e.preventDefault();

      // Calculate new position
      const clientX = e.type === "touchmove" ? e.touches[0].clientX : e.clientX;
      const clientY = e.type === "touchmove" ? e.touches[0].clientY : e.clientY;

      const dx = clientX - startX;
      const dy = clientY - startY;

      // Calculate new position
      let newLeft = startLeft + dx;
      let newTop = startTop + dy;

      // Ensure panel stays within viewport
      const maxLeft = window.innerWidth - element.offsetWidth;
      const maxTop = window.innerHeight - element.offsetHeight;

      newLeft = Math.min(Math.max(0, newLeft), maxLeft);
      newTop = Math.min(Math.max(0, newTop), maxTop);

      // Apply new position
      element.style.left = `${newLeft}px`;
      element.style.top = `${newTop}px`;
    }

    function stopDrag() {
      if (!isDragging) return;
      isDragging = false;

      // Remove listeners
      document.removeEventListener("mousemove", doDrag);
      document.removeEventListener("touchmove", doDrag);
      document.removeEventListener("mouseup", stopDrag);
      document.removeEventListener("touchend", stopDrag);

      // Remove dragging class
      element.classList.remove("dragging");
    }
  }

  // Old draggable implementation - replaced
  makeDraggable(element, handle) {
    // This method is now deprecated, using makeDraggableBetter instead
    this.makeDraggableBetter(element, handle);
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

    // Focus the input if it's a new empty filter
    if (!value) {
      setTimeout(() => input.focus(), 50);
    }

    return row;
  }

  // Apply filters to the page
  applyFilters() {
    const applyBtn = document.getElementById("apply-btn");
    applyBtn.textContent = "Filtering...";
    applyBtn.disabled = true;
    applyBtn.classList.add("btn-loading");

    // Reset the results counter
    const resultsCounter = document.getElementById("results-counter");
    resultsCounter.innerHTML =
      "<span class='loading-text'>Processing...</span>";

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
      // Store filtered products for reuse
      this.filteredProducts = {
        products: response.products,
        items: productItems,
      };

      // Create lookup for product data
      const productsByUrl = {};
      response.products.forEach((product) => {
        productsByUrl[product.url] = product;
      });

      // Count matches
      let matchCount = 0;

      // Apply results to items
      productItems.forEach(({ element, url }) => {
        const product = productsByUrl[url];
        if (product) {
          this.applyFilteringToItem(element, product);
          if (product.matches_filters) {
            matchCount++;
          }
        }
      });

      // Update the results counter
      this.lastResults = {
        total: productItems.length,
        matched: matchCount,
      };

      const resultsCounter = document.getElementById("results-counter");
      resultsCounter.innerHTML = `<span class="${matchCount === 0 ? "no-matches" : ""}">
        Matched <strong>${matchCount}</strong> of ${productItems.length} items
      </span>`;
    } else {
      const errorMessage = response?.error || "Unknown error";
      console.error("Filter error:", errorMessage);

      // Update the results counter with error
      const resultsCounter = document.getElementById("results-counter");
      resultsCounter.innerHTML = `<span class="error-text">Error: ${errorMessage}</span>`;

      alert(`Error: ${errorMessage}`);
    }

    // Reset button state
    applyBtn.innerHTML = `<svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>Apply Filters`;
    applyBtn.disabled = false;
    applyBtn.classList.remove("btn-loading");
  }

  // Method to reapply filtering with existing results
  reapplyFiltering() {
    // Can only reapply if we have previous results
    if (!this.filteredProducts) return;

    // First reset current filtering
    this.resetFiltering();

    // Get product data lookup
    const productsByUrl = {};
    this.filteredProducts.products.forEach((product) => {
      productsByUrl[product.url] = product;
    });

    // Reapply filtering to each item
    let matchCount = 0;
    this.filteredProducts.items.forEach(({ element, url }) => {
      const product = productsByUrl[url];
      if (product) {
        this.applyFilteringToItem(element, product);
        if (product.matches_filters) {
          matchCount++;
        }
      }
    });

    // Update the results counter
    const resultsCounter = document.getElementById("results-counter");
    resultsCounter.innerHTML = `<span class="${matchCount === 0 ? "no-matches" : ""}">
      Matched <strong>${matchCount}</strong> of ${this.filteredProducts.items.length} items
    </span>`;
  }

  // Apply filtering to a single product item
  applyFilteringToItem(element, product) {
    // Ensure proper positioning for the container
    if (window.getComputedStyle(element).position === "static") {
      element.style.position = "relative";
    }

    // Apply styling based on filter results
    if (!product.matches_filters) {
      // Check if we should hide or just dim
      const hideNonMatching =
        document.getElementById("hide-non-matching").checked;

      if (hideNonMatching) {
        element.style.display = "none"; // Hide element completely
      } else {
        element.style.opacity = "0.5";
        element.style.filter = "grayscale(70%)";
      }
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
      item.style.display = ""; // Reset display property too

      // Remove all smart filter elements
      item.querySelectorAll(".badge-container").forEach((el) => el.remove());
    });
  }
}
