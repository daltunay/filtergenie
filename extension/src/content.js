function getPlatform() {
  const reg = window.platformRegistry;
  const url = window.location.href;
  if (!reg || !reg._platforms?.length) return null;
  const host = new URL(url).hostname;
  return (
    reg._platforms.find((p) => {
      try {
        return p._config.hostPattern.test(host) && p.isSupported(url);
      } catch {
        return false;
      }
    }) || null
  );
}

async function fetchItemSources(platform, items) {
  return Promise.all(
    items.map(async (item) => ({
      platform: platform.name,
      html: await platform.getItemHtml(item),
    })),
  );
}

async function callApiAnalyze(items, filters, apiEndpoint, apiKey) {
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  apiEndpoint = apiEndpoint.replace(/\/+$/, "");
  const resp = await fetch(`${apiEndpoint}/items/analyze`, {
    method: "POST",
    headers,
    body: JSON.stringify({ items, filters }),
  });
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
    statusDiv.textContent = Object.entries(filterResults)
      .map(([desc, matched]) => `${matched ? "✔️" : "❌"} ${desc}`)
      .join(" ");
    item.style.display = matchCount >= minMatch ? "" : "none";
  });
}

async function analyzeItems(filters, minMatch, platform, maxItems = 10) {
  if (!platform) return;
  const items = Array.from(platform.getItemElements()).slice(0, maxItems);
  if (!items.length) return;
  const itemSources = await fetchItemSources(platform, items);
  const { apiEndpoint, apiKey } = await window.getApiSettings();
  let data;
  try {
    data = await callApiAnalyze(itemSources, filters, apiEndpoint, apiKey);
  } catch {
    return;
  }
  if (!data.filters) return;
  updateItemStatus(items, data.filters, minMatch);
}

function updateItemVisibility(minMatch) {
  const platform = getPlatform();
  if (!platform) return;
  const maxItems =
    parseInt(document.getElementById("max-items")?.value, 10) || 10;
  const items = Array.from(platform.getItemElements()).slice(0, maxItems);
  items.forEach((item) => {
    const statusDiv = item.querySelector(".filtergenie-status");
    const matchCount = (statusDiv?.textContent.match(/✔️/g) || []).length;
    item.style.display = matchCount >= minMatch ? "" : "none";
  });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "APPLY_FILTERS") {
    const platform = getPlatform();
    analyzeItems(msg.activeFilters, msg.minMatch, platform, msg.maxItems ?? 10);
  }
  if (msg.type === "UPDATE_MIN_MATCH") updateItemVisibility(msg.minMatch);
});
