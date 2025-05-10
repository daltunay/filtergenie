function getPlatform() {
  const registry = window.platformRegistry;
  const url = window.location.href;
  if (!registry) {
    console.warn("window.platformRegistry is not defined");
    return null;
  }
  if (!registry._platforms || !registry._platforms.length) {
    console.warn("No platforms registered in registry at", url);
    return null;
  }
  const host = new URL(url).hostname;
  console.log("Registered platforms:", registry._platforms.map(p => p.name));
  for (const p of registry._platforms) {
    try {
      console.log(`Checking platform "${p.name}"`);
      console.log(`  hostPattern:`, p._config.hostPattern);
      console.log(`  url:`, url);
      console.log(`  host:`, host);
      const hostMatch = p._config.hostPattern.test(host);
      console.log(`  hostPattern.test(host):`, hostMatch);
      if (!hostMatch) continue;
      const supported = p.isSupported(url);
      console.log(`  isSupported(${url}):`, supported);
      if (supported) {
        return p;
      }
    } catch (err) {
      console.warn(`Error checking isSupported for platform "${p.name}":`, err);
    }
  }
  console.warn("No matching platform for URL:", url, "host:", host);
  return null;
}

async function analyzeItems(filters, minMatch, platform) {
  if (!platform) {
    console.warn("No platform found for analyzeItems");
    return;
  }
  const items = Array.from(platform.getItemElements());
  if (!items.length) {
    console.warn("No items found for platform", platform.name);
    return;
  }
  const itemSources = await Promise.all(
    items.map(async (item) => ({
      platform: platform.name,
      html: await platform.getItemHtml(item),
    })),
  );

  const { apiEndpoint, apiKey } = await window.getApiSettings();
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  let resp, data;
  try {
    resp = await fetch(`${apiEndpoint}/items/analyze`, {
      method: "POST",
      headers,
      body: JSON.stringify({ items: itemSources, filters }),
    });
    data = await resp.json();
  } catch (err) {
    console.error("Error calling API:", err);
    return;
  }

  if (!data.filters) {
    console.warn("No filters in API response", data);
    return;
  }

  data.filters.forEach((filterResults, idx) => {
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

function updateItemVisibility(minMatch) {
  const platform = getPlatform();
  if (!platform) {
    console.warn("No platform found for updateItemVisibility");
    return;
  }
  document.querySelectorAll(platform._config?.itemSelector).forEach((item) => {
    const statusDiv = item.querySelector(".filtergenie-status");
    if (!statusDiv) return;
    const matchCount = (statusDiv.textContent.match(/✔️/g) || []).length;
    item.style.display = matchCount >= minMatch ? "" : "none";
  });
}

function handleMessage(msg, sender, sendResponse) {
  console.log("FilterGenie content script received message:", msg);
  if (msg.type === "APPLY_FILTERS") {
    const platform = getPlatform();
    analyzeItems(msg.activeFilters, msg.minMatch, platform);
  }
  if (msg.type === "UPDATE_MIN_MATCH") {
    updateItemVisibility(msg.minMatch);
  }
}

chrome.runtime.onMessage.addListener(handleMessage);
