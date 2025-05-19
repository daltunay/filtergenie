import { platformRegistry } from "../utils/platformRegistry.js";
import "../platforms/leboncoin.js";
import "../platforms/vinted.js";
import { showItemSpinner, removeItemSpinner } from "../utils/spinnerUtils.js";

function getPlatform() {
  const reg = platformRegistry;
  const url = window.location.href;
  if (!reg || !reg._platforms?.length) return null;
  return reg.getCurrentPlatform(url);
}

async function fetchItemSources(platform, items) {
  return Promise.all(
    items.map(async (item) => {
      const html = await platform.getItemHtml(item);
      let images = [];
      try {
        const doc = new DOMParser().parseFromString(html, "text/html");
        images = Array.from(doc.querySelectorAll("img"))
          .map((img) => img.src)
          .filter(Boolean);
      } catch {}
      return {
        platform: platform.name,
        url: platform.getItemUrl(item),
        html,
        images,
      };
    }),
  );
}

async function callApiAnalyze(
  items,
  filters,
  apiEndpoint,
  apiKey,
  maxImagesPerItem,
) {
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers["X-API-Key"] = apiKey;
  apiEndpoint = apiEndpoint.replace(/\/+$/, "");

  try {
    const resp = await fetch(`${apiEndpoint}/items/analyze`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        items,
        filters,
        max_images_per_item: maxImagesPerItem,
      }),
    });
    return resp.json();
  } catch (e) {
    throw e;
  }
}

function updateItemStatus(items, filtersData, minMatch) {
  if (!document.getElementById("filtergenie-status-style")) {
    const style = document.createElement("style");
    style.id = "filtergenie-status-style";
    style.textContent = `
      .filtergenie-status {
        display: flex !important;
        width: 100% !important;
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        background: none !important;
        border: none !important;
        z-index: 10;
        overflow: visible !important;
        position: relative;
        min-height: 0;
      }
      .filtergenie-status .filtergenie-status-block {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: flex-start;
        width: 100%;
        row-gap: 6px;
      }
    `;
    document.head.appendChild(style);
  }

  const platform = getPlatform();

  items.forEach((item, idx) => {
    const filterResults = filtersData[idx] || {};
    const matchCount = Object.values(filterResults).filter(Boolean).length;
    const container = platform ? platform.getItemContainer(item) : item;
    let statusDiv = container.querySelector(".filtergenie-status");
    if (!statusDiv) {
      statusDiv = document.createElement("div");
      statusDiv.className = "filtergenie-status";
      container.appendChild(statusDiv);
    }
    const ordered = Object.entries(filterResults).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    statusDiv.innerHTML =
      '<div class="filtergenie-status-block">' +
      ordered
        .map(
          ([desc, matched]) =>
            `<span style="display:inline-flex;align-items:center;padding:2px 8px;border-radius:8px;font-size:13px;${matched ? "background:rgba(34,197,94,0.13);color:#4ade80;" : "background:rgba(239,68,68,0.13);color:#f87171;"}margin-bottom:2px;max-width:100%;word-break:break-word;">${matched ? "✅" : "❌"} <span style='margin-left:5px;'>${desc}</span></span>`,
        )
        .join("") +
      "</div>";
    item.style.display = matchCount >= minMatch ? "" : "none";
  });
}

async function analyzeItems(
  filters,
  minMatch,
  platform,
  maxItems,
  sendResponse,
  apiEndpoint,
  apiKey,
  maxImagesPerItem,
) {
  if (!platform) return;

  const items = Array.from(platform.getItemElements()).slice(0, maxItems);
  if (!items.length) return;

  items.forEach((item) => {
    let div = item.querySelector(".filtergenie-status");
    if (!div) {
      div = document.createElement("div");
      div.className = "filtergenie-status";
      item.appendChild(div);
    }
    div.style.display = "none";
  });

  showItemSpinner(items);

  try {
    const itemSources = await fetchItemSources(platform, items);
    const sortedFilters = [...filters].sort((a, b) => a.localeCompare(b));
    const data = await callApiAnalyze(
      itemSources,
      sortedFilters,
      apiEndpoint,
      apiKey,
      maxImagesPerItem,
    );

    removeItemSpinner(items);

    if (data.filters) {
      updateItemStatus(items, data.filters, minMatch);
      chrome.storage.local.set({
        filtergenieLastAnalyzed: {
          filtersData: data.filters,
          minMatch,
          maxItems,
          timestamp: Date.now(),
        },
      });
      chrome.runtime.sendMessage({ type: "FILTERS_APPLIED", success: true });
      sendResponse?.({ apiResponse: data });
    } else {
      chrome.runtime.sendMessage({
        type: "FILTERS_APPLIED",
        success: false,
        error: "Invalid response format",
      });
      sendResponse?.({ apiResponse: "Invalid response format" });
    }
  } catch (error) {
    console.error("FilterGenie analysis error:", error);
    removeItemSpinner(items);
    chrome.runtime.sendMessage({
      type: "FILTERS_APPLIED",
      success: false,
      error: "API error",
    });
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
        msg.apiEndpoint,
        msg.apiKey,
        msg.maxImagesPerItem,
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
