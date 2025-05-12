import { platformRegistry } from "../utils/platformRegistry.js";
import "../platforms/leboncoin.js";
import "../platforms/vinted.js";
import { showSpinner, removeSpinner } from "../utils/spinnerUtils.js";
import {
  ApiSettings,
  DEFAULT_REMOTE_API_ENDPOINT,
  DEFAULT_LOCAL_API_ENDPOINT,
} from "../utils/apiSettings.js";

function getPlatform() {
  const reg = platformRegistry;
  const url = window.location.href;
  if (!reg || !reg._platforms?.length) return null;
  return reg.getCurrentPlatform(url);
}

function getApiEndpoint(apiMode) {
  return apiMode === "remote"
    ? DEFAULT_REMOTE_API_ENDPOINT
    : DEFAULT_LOCAL_API_ENDPOINT;
}

async function fetchItemSources(platform, items) {
  return Promise.all(
    items.map(async (item) => ({
      platform: platform.name,
      url: platform.getItemUrl(item),
      html: await platform.getItemHtml(item),
    })),
  );
}

async function callApiAnalyze(items, filters, apiEndpoint, apiKey) {
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers["X-API-Key"] = apiKey;
  apiEndpoint = apiEndpoint.replace(/\/+$/, "");

  try {
    const resp = await fetch(`${apiEndpoint}/items/analyze`, {
      method: "POST",
      headers,
      body: JSON.stringify({ items, filters }),
    });

    chrome.runtime.sendMessage({
      type: "API_STATUS",
      status: resp.status,
      error: resp.ok ? undefined : await resp.text(),
    });

    return resp.json();
  } catch (e) {
    const errorMessage = e?.message || String(e);
    chrome.runtime.sendMessage({
      type: "API_STATUS",
      status: 0,
      error: errorMessage,
    });
    throw e;
  }
}

function updateItemStatus(items, filtersData, minMatch) {
  items.forEach((item, idx) => {
    const filterResults = filtersData[idx] || {};
    const matchCount = Object.values(filterResults).filter(Boolean).length;

    let statusDiv = item.querySelector(".filtergenie-status");
    if (!statusDiv) {
      statusDiv = document.createElement("div");
      statusDiv.className = "filtergenie-status";
      item.appendChild(statusDiv);
    }

    const spinner = statusDiv.querySelector(".filtergenie-spinner-container");
    if (spinner) spinner.remove();

    statusDiv.style.display = "";
    statusDiv.innerHTML = Object.entries(filterResults)
      .map(([desc, matched]) => `${matched ? "✅" : "❌"} ${desc}`)
      .join("<br>");

    item.style.display = matchCount >= minMatch ? "" : "none";
  });
}

async function analyzeItems(
  filters,
  minMatch,
  platform,
  maxItems,
  sendResponse,
) {
  if (!platform) return;

  const items = Array.from(platform.getItemElements()).slice(0, maxItems);
  if (!items.length) return;

  const statusDivs = items.map((item) => {
    let div = item.querySelector(".filtergenie-status");
    if (!div) {
      div = document.createElement("div");
      div.className = "filtergenie-status";
      item.appendChild(div);
    }
    div.style.display = "none";
    return div;
  });

  showSpinner(
    items.map((item) => {
      return item;
    }),
  );

  try {
    const itemSources = await fetchItemSources(platform, items);
    const { apiMode, apiKey } = await ApiSettings.get();
    const apiEndpoint = getApiEndpoint(apiMode);

    const data = await callApiAnalyze(
      itemSources,
      filters,
      apiEndpoint,
      apiKey,
    );

    if (data.filters) {
      removeSpinner(items);
      updateItemStatus(items, data.filters, minMatch);

      chrome.storage.local.set({
        filtergenieLastAnalyzed: {
          filtersData: data.filters,
          minMatch,
          maxItems,
          timestamp: Date.now(),
        },
      });
    } else {
      removeSpinner(items);
    }

    sendResponse?.({
      apiResponse: data.filters ? data : "Invalid response format",
    });
  } catch (error) {
    console.error("FilterGenie analysis error:", error);
    removeSpinner(items);
    sendResponse?.({ apiResponse: "API error" });
  }
}

function updateItemVisibility(minMatch, maxItems) {
  const platform = getPlatform();
  if (!platform) return;

  const items = Array.from(platform.getItemElements()).slice(0, maxItems);
  items.forEach((item) => {
    const statusDiv = item.querySelector(".filtergenie-status");
    const matchCount = (statusDiv?.textContent.match(/✅/g) || []).length;
    item.style.display = matchCount >= minMatch ? "" : "none";
  });
}

function handleMessage(msg, sender, sendResponse) {
  if (msg.type === "PING") {
    sendResponse({ type: "PONG" });
    return true;
  }

  switch (msg.type) {
    case "APPLY_FILTERS":
      analyzeItems(
        msg.activeFilters,
        msg.minMatch,
        getPlatform(),
        msg.maxItems,
        sendResponse,
      );
      return true;

    case "UPDATE_MIN_MATCH":
      updateItemVisibility(
        msg.minMatch,
        typeof msg.maxItems === "number" ? msg.maxItems : 10,
      );
      return false;

    case "RESET_FILTERS_ON_PAGE":
      document
        .querySelectorAll(".filtergenie-status")
        .forEach((el) => el.remove());
      return false;
  }

  return false;
}

function initializeContentScript() {
  chrome.runtime.onMessage.addListener(handleMessage);

  const platform = getPlatform();
  if (platform && platform.isSearchPage(window.location.href)) {
    chrome.storage.local.get("filtergenieLastAnalyzed", (res) => {
      const last = res.filtergenieLastAnalyzed;
      if (!last?.filtersData) return;

      const maxItems = typeof last.maxItems === "number" ? last.maxItems : 10;
      const items = Array.from(platform.getItemElements()).slice(0, maxItems);
      if (!items.length) return;

      updateItemStatus(items, last.filtersData, last.minMatch);
    });

    chrome.storage.local.set({ popupAppliedFilters: [] });

    console.log(
      "FilterGenie: Content script initialized successfully on supported website",
    );
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeContentScript);
} else {
  initializeContentScript();
}
