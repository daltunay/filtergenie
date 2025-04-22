/**
 * SmartFilter - Background Service
 * Optimized for RESTful HTML-based approach
 */

const config = {
  api: {
    url: "http://localhost:8000",
    key: "",
  },
};

// Cache for HTML content to avoid re-fetching within the same session
const htmlCache = new Map();
const cacheTTL = 5 * 60 * 1000; // 5 minutes in milliseconds

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

  if (request.action === "fetchHtml") {
    fetchHtmlContent(request.url)
      .then((html) => sendResponse({ success: true, html }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }

  if (request.action === "analyzeProducts") {
    analyzeProducts(request)
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

/**
 * Fetch HTML content with caching for performance
 * @param {string} url
 * @returns {Promise<string>} HTML content
 */
async function fetchHtmlContent(url) {
  try {
    // Check cache first
    const cacheEntry = htmlCache.get(url);
    if (cacheEntry && Date.now() - cacheEntry.timestamp < cacheTTL) {
      console.log(`Using cached HTML for ${url}`);
      return cacheEntry.html;
    }

    console.log(`Fetching HTML for ${url}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(url, {
      signal: controller.signal,
      credentials: "omit", // Don't send cookies for cross-origin requests
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
 * Send HTML content to backend for analysis using the RESTful API
 * @param {Object} request Request with filters and product data
 * @returns {Promise<Object>} Analysis results
 */
async function analyzeProducts(request) {
  try {
    const headers = { "Content-Type": "application/json" };

    // Add API key header if configured
    if (config.api.key && config.api.key.trim() !== "") {
      headers["X-API-Key"] = config.api.key;
    }

    // Create the product objects array
    const products = request.productUrls.map((url, index) => ({
      url,
      html: request.htmlContents[index],
    }));

    // Send to the RESTful API endpoint
    const response = await fetch(`${config.api.url}/products/analyze`, {
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

// Clear HTML cache periodically to prevent memory growth
setInterval(() => {
  const now = Date.now();
  for (const [url, entry] of htmlCache.entries()) {
    if (now - entry.timestamp > cacheTTL) {
      htmlCache.delete(url);
    }
  }
}, 60000); // Check every minute

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    try {
      const headers = {};
      if (config.api.key) {
        headers["X-API-Key"] = config.api.key;
      }

      const url = `${config.api.url}/vendors/check?url=${encodeURIComponent(tab.url)}`;

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
