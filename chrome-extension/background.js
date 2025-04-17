/**
 * SmartFilter - Background Script
 */

let API_URL = "http://localhost:8000"; // Default API URL
let API_KEY = ""; // Default empty API key

const ICON_PATHS = {
  16: "images/icon16.png",
  48: "images/icon48.png",
  128: "images/icon128.png",
};

// Load API settings when extension starts
chrome.storage.local.get(['api_settings'], function(result) {
  if (result.api_settings) {
    API_URL = result.api_settings.endpoint || API_URL;
    API_KEY = result.api_settings.key || API_KEY;
    console.log("Loaded API settings:", API_URL);
  }
});

// Listen for settings changes
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "apiSettingsChanged") {
    try {
      // Validate URL format
      if (request.settings.endpoint) {
        try {
          new URL(request.settings.endpoint); // Will throw if invalid
          API_URL = request.settings.endpoint;
        } catch (e) {
          console.error("Invalid API URL format:", request.settings.endpoint);
          sendResponse({success: false, error: "Invalid URL format"});
          return true;
        }
      } else {
        API_URL = "http://localhost:8000"; // Default if empty
      }
      
      API_KEY = request.settings.key || "";
      console.log("Updated API settings:", API_URL);
      sendResponse({success: true});
      return true;
    } catch (error) {
      console.error("Error updating API settings:", error);
      sendResponse({success: false, error: error.message});
      return true;
    }
  }
  
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
    const headers = { "Content-Type": "application/json" };
    
    // Add API key to headers if it exists
    if (API_KEY) {
      headers["X-API-Key"] = API_KEY;
    }
    
    const response = await fetch(`${API_URL}/extension/filter`, {
      method: "POST",
      headers: headers,
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
    const headers = {};
    if (API_KEY) {
      headers["X-API-Key"] = API_KEY;
    }
    
    const response = await fetch(
      `${API_URL}/extension/check-url?url=${encodeURIComponent(url)}`,
      { headers }
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
