/**
 * SmartFilter - Background Script
 *
 * This script runs in the extension's background service worker.
 * It handles:
 * - Communication with the backend API
 * - Tab state monitoring and icon management
 * - Messaging between popup and content scripts
 */

const API_URL = "http://localhost:8000";
const ICON_PATHS = {
  16: "images/icon16.png",
  48: "images/icon48.png",
  128: "images/icon128.png",
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "filterProducts") {
    handleFilterRequest(request)
      .then(sendResponse)
      .catch((error) =>
        sendResponse({
          success: false,
          error: error.message || "Unknown error",
        }),
      );
    return true;
  }
});

async function handleFilterRequest(request) {
  try {
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
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `API error (${response.status})`);
    }

    const data = await response.json();
    return { success: true, products: data.products };
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
}

async function checkUrlSupport(url) {
  try {
    const response = await fetch(
      `${API_URL}/extension/check-url?url=${encodeURIComponent(url)}`,
    );
    return response.ok ? await response.json() : { supported: false };
  } catch {
    return { supported: false };
  }
}

function updateBadgeForTab(tabId, isSupported) {
  chrome.action.setBadgeText({
    tabId,
    text: isSupported ? "✓" : "",
  });

  if (isSupported) {
    chrome.action.setBadgeBackgroundColor({ tabId, color: "#10b981" });
  }
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    // Set icon with constant path
    chrome.action.setIcon({ tabId, path: ICON_PATHS });

    // Check if site is supported and update badge
    const { supported } = await checkUrlSupport(tab.url);
    updateBadgeForTab(tabId, supported);
  }
});
