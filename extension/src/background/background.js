/**
 * SmartFilter - Background Service
 * Simplified RESTful API handling
 */

const config = {
  api: {
    url: "http://localhost:8000",
    key: "",
  },
};

// Cache for HTML content to avoid re-fetching (5-minute TTL)
const htmlCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Load stored API settings
chrome.storage.local.get(["api_settings"], function (result) {
  if (result.api_settings) {
    config.api.url = result.api_settings.endpoint || config.api.url;
    config.api.key = result.api_settings.key || "";
  }
});

// Handle extension messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Update API settings
  if (request.action === "apiSettingsChanged") {
    handleApiSettingsChange(request, sendResponse);
    return true;
  }

  // Fetch HTML content
  if (request.action === "fetchHtml") {
    fetchHtmlContent(request.url)
      .then((html) => sendResponse({ success: true, html }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // Analyze products
  if (request.action === "analyzeProducts") {
    analyzeProducts(request)
      .then(sendResponse)
      .catch((error) =>
        sendResponse({ success: false, error: error.message || "API error" }),
      );
    return true;
  }
});

// Handle API settings changes
function handleApiSettingsChange(request, sendResponse) {
  try {
    // Validate URL if provided
    if (request.settings.endpoint) {
      try {
        new URL(request.settings.endpoint);
        config.api.url = request.settings.endpoint;
      } catch (e) {
        sendResponse({ success: false, error: "Invalid URL format" });
        return;
      }
    } else {
      config.api.url = "http://localhost:8000";
    }

    config.api.key = request.settings.key || "";
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Fetch HTML content with caching
 */
async function fetchHtmlContent(url) {
  try {
    // Check cache first
    const cacheEntry = htmlCache.get(url);
    if (cacheEntry && Date.now() - cacheEntry.timestamp < CACHE_TTL) {
      console.log(`Using cached HTML for ${url}`);
      return cacheEntry.html;
    }

    console.log(`Fetching HTML for ${url}`);

    // Set timeout for fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      credentials: "omit",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml",
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const html = await response.text();

    // Cache the result
    htmlCache.set(url, {
      html,
      timestamp: Date.now(),
    });

    return html;
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    throw error;
  }
}

/**
 * Send products to backend API for analysis
 */
async function analyzeProducts(request) {
  try {
    // Build request headers
    const headers = { "Content-Type": "application/json" };
    if (config.api.key && config.api.key.trim() !== "") {
      headers["X-API-Key"] = config.api.key;
    }

    // Format products data for API
    const products = request.productUrls.map((url, index) => ({
      url,
      html: request.htmlContents[index],
    }));

    // Send request to API
    const apiUrl = `${config.api.url}/products/analyze`;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        filters: request.filters,
        products: products,
        threshold: request.threshold || 1,
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

// Clean up expired cache entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [url, entry] of htmlCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      htmlCache.delete(url);
    }
  }
}, 60000);

// Check if current site is supported
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    try {
      const headers = {};
      if (config.api.key) {
        headers["X-API-Key"] = config.api.key;
      }

      const checkUrl = `${config.api.url}/vendors/check?url=${encodeURIComponent(tab.url)}`;
      const response = await fetch(checkUrl, { headers });
      const data = response.ok ? await response.json() : { supported: false };

      // Update extension badge
      chrome.action.setBadgeText({
        tabId,
        text: data.supported ? "✓" : "",
      });

      if (data.supported) {
        chrome.action.setBadgeBackgroundColor({ tabId, color: "#10b981" });
      }
    } catch (error) {
      console.error("Error checking vendor support:", error);
    }
  }
});
