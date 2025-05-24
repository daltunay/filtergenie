import { platformRegistry } from "../utils/platformRegistry.js";
import "../platforms/leboncoin.js";
import "../platforms/vinted.js";
import { showItemSpinner, removeItemSpinner } from "../utils/spinnerUtils.js";

const platform = platformRegistry.current(window.location.href);

function ensureStatusDiv(item) {
  let div = item.querySelector(".filtergenie-status");
  if (!div) {
    div = document.createElement("div");
    div.className = "filtergenie-status";
    item.appendChild(div);
  }
  div.style.display = "none";
}

async function fetchItemSource(item) {
  const html = await platform.getItemHtml(item);
  const doc = new DOMParser().parseFromString(html, "text/html");
  const images = Array.from(doc.querySelectorAll("img"))
    .map((img) => img.src)
    .filter(Boolean);
  return {
    platform: platform.name,
    url: platform.getItemUrl(item),
    html,
    images,
  };
}

async function analyzeItems(
  filters,
  minMatch,
  maxItems,
  sendResponse,
  apiEndpoint,
  apiKey,
  maxImagesPerItem,
) {
  if (!platform) return;
  const items = Array.from(platform.getItemElements()).slice(0, maxItems);
  if (!items.length) return;
  items.forEach(ensureStatusDiv);
  showItemSpinner(items);
  const sortedFilters = [...filters].sort();
  chrome.runtime.sendMessage({ type: "API_STATUS", state: "filtering" });
  const itemSources = await Promise.all(items.map(fetchItemSource));
  const results = await Promise.all(
    itemSources.map((itemSource) =>
      callApiAnalyzeSingle(
        itemSource,
        sortedFilters,
        apiEndpoint,
        apiKey,
        maxImagesPerItem,
      ),
    ),
  );
  results.forEach((data, idx) => {
    removeItemSpinner([items[idx]]);
    updateItemStatus([items[idx]], [data.filters], minMatch);
  });
  chrome.runtime.sendMessage({ type: "API_STATUS", state: "done" });
  chrome.runtime.sendMessage({ type: "FILTERS_APPLIED", success: true });
  sendResponse?.({ apiResponse: { filters: results.map((r) => r.filters) } });
}

async function callApiAnalyzeSingle(
  itemSource,
  filters,
  apiEndpoint,
  apiKey,
  maxImagesPerItem,
) {
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers["X-API-Key"] = apiKey;
  apiEndpoint = apiEndpoint.replace(/\/+$/, "");
  const resp = await fetch(`${apiEndpoint}/item/analyze`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      item: itemSource,
      filters,
      max_images: maxImagesPerItem,
    }),
  });
  return resp.json();
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
  items.forEach((item, idx) => {
    const filterResults = filtersData[idx] || {};
    const matchCount = Object.values(filterResults).filter(Boolean).length;
    let statusDiv = item.querySelector(".filtergenie-status");
    if (!statusDiv) {
      statusDiv = document.createElement("div");
      statusDiv.className = "filtergenie-status";
      item.appendChild(statusDiv);
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

function updateItemVisibility(minMatch, maxItems) {
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
  document.querySelectorAll(".filtergenie-status").forEach((el) => el.remove());
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeContentScript);
} else {
  initializeContentScript();
}
