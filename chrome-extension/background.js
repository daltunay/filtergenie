// Background script for Smart Filter extension

const API_URL = "http://localhost:8000";

// Simplified API fetch wrapper
async function callAPI(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });

    if (!response.ok) {
      const errorData = response.headers.get("content-type")?.includes("application/json")
        ? await response.json()
        : { detail: await response.text() || `HTTP error ${response.status}` };
      throw new Error(errorData.detail || `API error (${response.status})`);
    }

    return await (
      endpoint === "/render/filter_badges" ? response.text() : response.json()
    );
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
}

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "filterProducts") {
    handleFilterRequest(request).then(sendResponse).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep channel open for async response
  }

  if (request.action === "renderBadges") {
    renderBadges(request).then(sendResponse).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep channel open for async response
  }
});

// Handle filtering products
async function handleFilterRequest(request) {
  try {
    // Step 1: Extract product IDs from URLs
    const productIds = await callAPI("/extract/product_ids", {
      method: "POST",
      body: JSON.stringify({ urls: request.productUrls }),
    });

    // Step 2: Convert IDs to integers for filtering
    const numericIds = Object.values(productIds)
      .map(id => parseInt(id, 10))
      .filter(id => !isNaN(id));

    // Step 3: Call filter API
    const filterResult = await callAPI("/filter", {
      method: "POST",
      body: JSON.stringify({
        url: request.url,
        filters: request.filters,
        product_ids: numericIds,
        max_products: request.maxItems
      }),
    });

    return {
      success: true,
      products: filterResult.products,
      productIds: productIds
    };
  } catch (error) {
    console.error("Filter request error:", error);
    return {
      success: false,
      error: error.message || "Unknown error occurred"
    };
  }
}

// Handle badge rendering
async function renderBadges(request) {
  try {
    const html = await callAPI("/render/filter_badges", {
      method: "POST",
      body: JSON.stringify({
        filters: request.filters,
        container_class: "smart-filter-results"
      }),
    });

    return {
      success: true,
      html
    };
  } catch (error) {
    console.error("Failed to render badges:", error);
    return {
      success: false,
      error: error.message,
      // Provide fallback simple HTML if API fails
      html: `<div class="smart-filter-results" style="position:absolute;top:0;left:0;z-index:1000;"></div>`
    };
  }
}
