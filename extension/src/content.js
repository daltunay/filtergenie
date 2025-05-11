function getPlatform() {
  const reg = window.platformRegistry;
  const url = window.location.href;
  if (!reg || !reg._platforms?.length) return null;
  return reg.getCurrentPlatform(url);
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
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  apiEndpoint = apiEndpoint.replace(/\/+$/, "");
  let resp;
  try {
    resp = await fetch(`${apiEndpoint}/items/analyze`, {
      method: "POST",
      headers,
      body: JSON.stringify({ items, filters }),
    });
    chrome.runtime.sendMessage({
      type: "API_STATUS",
      status: resp.status,
      error: resp.ok ? undefined : await resp.text(),
    });
  } catch (e) {
    chrome.runtime.sendMessage({
      type: "API_STATUS",
      status: 0,
      error: e && e.message ? e.message : String(e),
    });
    throw e;
  }
  return resp.json();
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
    statusDiv.innerHTML = Object.entries(filterResults)
      .map(([desc, matched]) => `${matched ? "✔️" : "❌"} ${desc}`)
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
  const itemSources = await fetchItemSources(platform, items);
  const { apiMode, apiKey } = await window.getApiSettings();
  let apiEndpoint =
    apiMode === "remote"
      ? window.DEFAULT_REMOTE_API_ENDPOINT
      : window.DEFAULT_LOCAL_API_ENDPOINT;
  let data;
  try {
    data = await callApiAnalyze(itemSources, filters, apiEndpoint, apiKey);
  } catch {
    if (sendResponse) sendResponse({ apiResponse: "API error" });
    return;
  }
  if (!data.filters) {
    if (sendResponse) sendResponse({ apiResponse: data });
    return;
  }
  updateItemStatus(items, data.filters, minMatch);
  if (sendResponse) sendResponse({ apiResponse: data });
}

function updateItemVisibility(minMatch) {
  const platform = getPlatform();
  if (!platform) return;
  const maxItemsInput = document.getElementById("max-items");
  const maxItems = parseInt(maxItemsInput?.value, 10) || 10;
  const items = Array.from(platform.getItemElements()).slice(0, maxItems);
  items.forEach((item) => {
    const statusDiv = item.querySelector(".filtergenie-status");
    const matchCount = (statusDiv?.textContent.match(/✔️/g) || []).length;
    item.style.display = matchCount >= minMatch ? "" : "none";
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "APPLY_FILTERS") {
    const platform = getPlatform();
    analyzeItems(
      msg.activeFilters,
      msg.minMatch,
      platform,
      msg.maxItems,
      sendResponse,
    );
    return true;
  }
  if (msg.type === "UPDATE_MIN_MATCH") updateItemVisibility(msg.minMatch);
});
