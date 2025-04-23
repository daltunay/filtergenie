const config = {
  api: {
    url: "http://localhost:8000",
    key: "",
  },
};

const htmlCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

chrome.storage.local.get(["api_settings"], function (result) {
  if (result.api_settings) {
    config.api.url = result.api_settings.endpoint || config.api.url;
    config.api.key = result.api_settings.key || "";
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { action, ...data } = request;

  const actions = {
    apiSettingsChanged: () => {
      const { endpoint, key } = data.settings;

      if (endpoint) {
        try {
          new URL(endpoint);
          config.api.url = endpoint;
        } catch {
          sendResponse({ success: false, error: "Invalid URL format" });
          return;
        }
      } else {
        config.api.url = "http://localhost:8000";
      }

      config.api.key = key || "";
      sendResponse({ success: true });
    },

    fetchHtml: async () => {
      try {
        const html = await fetchHtmlContent(data.url);
        sendResponse({ success: true, html });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    },

    analyzeProducts: async () => {
      try {
        const result = await analyzeProducts(data);
        sendResponse(result);
      } catch (error) {
        sendResponse({ success: false, error: error.message || "API error" });
      }
    },
  };

  if (actions[action]) {
    actions[action]();
    return true;
  } else {
    sendResponse({ success: false, error: "Unknown action" });
    return false;
  }
});

async function fetchHtmlContent(url) {
  const cacheEntry = htmlCache.get(url);

  if (cacheEntry && Date.now() - cacheEntry.timestamp < CACHE_TTL) {
    return cacheEntry.html;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
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
    htmlCache.set(url, { html, timestamp: Date.now() });
    return html;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function analyzeProducts(data) {
  const { filters, productUrls, htmlContents, threshold = 1 } = data;

  const headers = { "Content-Type": "application/json" };
  if (config.api.key?.trim()) {
    headers["X-API-Key"] = config.api.key;
  }

  const products = productUrls.map((url, index) => ({
    url,
    html: htmlContents[index],
  }));

  const response = await fetch(`${config.api.url}/products/analyze`, {
    method: "POST",
    headers,
    body: JSON.stringify({ filters, products, threshold }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `API error (${response.status})`);
  }

  const result = await response.json();
  return { success: true, products: result.products };
}

setInterval(() => {
  const now = Date.now();
  htmlCache.forEach((entry, url) => {
    if (now - entry.timestamp > CACHE_TTL) {
      htmlCache.delete(url);
    }
  });
}, 60000);

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { action: "getVendorInfo" });

      if (response?.success) {
        chrome.action.setBadgeText({ tabId, text: "✓" });
        chrome.action.setBadgeBackgroundColor({ tabId, color: "#10b981" });
      } else {
        chrome.action.setBadgeText({ tabId, text: "" });
      }
    } catch (error) {
      console.error("Error checking vendor support:", error);
      chrome.action.setBadgeText({ tabId, text: "" });
    }
  }
});
