// Background script for Smart Filter extension

const API_URL = "http://localhost:8000";

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "filterProducts") {
    filterProducts(request)
      .then(sendResponse)
      .catch((error) => {
        console.error("Filter error:", error);
        sendResponse({
          success: false,
          error: error.message || "Unknown error",
        });
      });
    return true; // Keep channel open for async response
  }
});

// Filter products with a single API call
async function filterProducts(request) {
  try {
    // We'll still use the batch endpoint for the extension
    // The API will internally use the cached endpoints
    const response = await fetch(`${API_URL}/extension/filter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filters: request.filters,
        product_urls: request.productUrls,
        max_products: request.maxItems,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `API error (${response.status})`);
    }

    const data = await response.json();
    return { success: true, products: data.products };
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
}
