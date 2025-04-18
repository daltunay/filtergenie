/**
 * SmartFilter - Background Service
 * Simplified version with cleaner code organization
 */

const config = {
  api: {
    url: "http://localhost:8000",
    key: "",
  },
};

chrome.storage.local.get(["api_settings"], function (result) {
  if (result.api_settings) {
    config.api.url = result.api_settings.endpoint || config.api.url;
    config.api.key = result.api_settings.key || "";
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "apiSettingsChanged") {
    try {
      if (request.settings.endpoint) {
        try {
          new URL(request.settings.endpoint);
          config.api.url = request.settings.endpoint;
        } catch (e) {
          sendResponse({ success: false, error: "Invalid URL format" });
          return true;
        }
      } else {
        config.api.url = "http://localhost:8000";
      }

      config.api.key = request.settings.key || "";
      sendResponse({ success: true });
      return true;
    } catch (error) {
      sendResponse({ success: false, error: error.message });
      return true;
    }
  }

  if (request.action === "filterProducts") {
    handleFilterRequest(request)
      .then(sendResponse)
      .catch((error) =>
        sendResponse({
          success: false,
          error: error.message || "API error",
        }),
      );
    return true;
  }
});

async function handleFilterRequest(request) {
  try {
    const headers = { "Content-Type": "application/json" };

    // Only add the API key header if one is configured and not empty
    if (config.api.key && config.api.key.trim() !== "") {
      headers["X-API-Key"] = config.api.key;
    }

    const response = await fetch(`${config.api.url}/extension/filter`, {
      method: "POST",
      headers,
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

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    try {
      // Only add the API key header if one is configured
      const headers = {};
      if (config.api.key) {
        headers["X-API-Key"] = config.api.key;
      }
      
      const url = `${config.api.url}/extension/check-url?url=${encodeURIComponent(tab.url)}`;

      const response = await fetch(url, { headers });
      const data = response.ok ? await response.json() : { supported: false };

      chrome.action.setBadgeText({
        tabId,
        text: data.supported ? "✓" : "",
      });

      if (data.supported) {
        chrome.action.setBadgeBackgroundColor({ tabId, color: "#10b981" });
      }
    } catch {}
  }
});
