function getPlatform() {
  const registry = window.platformRegistry;
  const url = window.location.href;
  if (!registry || !registry._platforms?.length) return null;
  const host = new URL(url).hostname;
  for (const p of registry._platforms) {
    try {
      if (p._config.hostPattern.test(host) && p.isSupported(url)) return p;
    } catch {}
  }
  return null;
}

async function fetchItemSources(platform) {
  const items = Array.from(platform.getItemElements());
  return Promise.all(
    items.map(async (item) => ({
      platform: platform.name,
      html: await platform.getItemHtml(item),
    }))
  );
}

async function callApiAnalyze(items, filters, apiEndpoint, apiKey) {
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  const resp = await fetch(`${apiEndpoint}/items/analyze`, {
    method: "POST",
    headers,
    body: JSON.stringify({ items, filters }),
  });
  return resp.json();
}

function updateItemStatus(items, filtersData, minMatch) {
  filtersData.forEach((filterResults, idx) => {
    const item = items[idx];
    let matchCount = 0;
    let statusText = "";
    for (const [desc, matched] of Object.entries(filterResults)) {
      statusText += `${matched ? "✔️" : "❌"} ${desc} `;
      if (matched) matchCount++;
    }
    let statusDiv = item.querySelector(".filtergenie-status");
    if (!statusDiv) {
      statusDiv = document.createElement("div");
      statusDiv.className = "filtergenie-status";
      item.appendChild(statusDiv);
    }
    statusDiv.textContent = statusText.trim();
    item.style.display = matchCount >= minMatch ? "" : "none";
  });
}

async function analyzeItems(filters, minMatch, platform) {
  if (!platform) return;
  const items = Array.from(platform.getItemElements());
  if (!items.length) return;
  const itemSources = await fetchItemSources(platform);
  const { apiEndpoint, apiKey } = await window.getApiSettings();
  let data;
  try {
    data = await callApiAnalyze(itemSources, filters, apiEndpoint, apiKey);
  } catch {
    console.log("api err");
    return;
  }
  if (!data.filters) return;
  updateItemStatus(items, data.filters, minMatch);
}

function updateItemVisibility(minMatch) {
  const platform = getPlatform();
  if (!platform) return;
  document.querySelectorAll(platform._config?.itemSelector).forEach((item) => {
    const statusDiv = item.querySelector(".filtergenie-status");
    if (!statusDiv) return;
    const matchCount = (statusDiv.textContent.match(/✔️/g) || []).length;
    item.style.display = matchCount >= minMatch ? "" : "none";
  });
}

function handleMessage(msg) {
  if (msg.type === "APPLY_FILTERS") {
    const platform = getPlatform();
    analyzeItems(msg.activeFilters, msg.minMatch, platform);
  }
  if (msg.type === "UPDATE_MIN_MATCH") {
    updateItemVisibility(msg.minMatch);
  }
}

chrome.runtime.onMessage.addListener(handleMessage);
