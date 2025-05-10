function getApiSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      { apiEndpoint: "http://localhost:8000", apiKey: "" },
      ({ apiEndpoint, apiKey }) => resolve({ apiEndpoint, apiKey }),
    );
  });
}

async function analyzeItems(filters, minMatch, platform) {
  const items = Array.from(platform.getItemElements());
  const itemSources = await Promise.all(
    items.map(async (item) => ({
      platform: platform.name,
      html: await platform.getItemHtml(item),
    })),
  );

  const { apiEndpoint, apiKey } = await getApiSettings();

  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const resp = await fetch(`${apiEndpoint}/items/analyze`, {
    method: "POST",
    headers,
    body: JSON.stringify({ items: itemSources, filters }),
  });
  const data = await resp.json();

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

const updateItemVisibility = (minMatch) => {
  const registry = window.platformRegistry;
  const platform = registry.getCurrentPlatform(window.location.href);
  if (!platform) return;
  document
    .querySelectorAll(
      platform._config?.itemSelector || 'article[data-test-id="ad"]',
    )
    .forEach((item) => {
      const statusDiv = item.querySelector(".filtergenie-status");
      if (!statusDiv) return;
      const matchCount = (statusDiv.textContent.match(/✔️/g) || []).length;
      item.style.display = matchCount >= minMatch ? "" : "none";
    });
};

chrome.runtime.onMessage.addListener((msg) => {
  const registry = window.platformRegistry;
  if (msg.type === "APPLY_FILTERS") {
    const platform = registry.getCurrentPlatform(window.location.href);
    analyzeItems(msg.activeFilters, msg.minMatch, platform);
  }
  if (msg.type === "UPDATE_MIN_MATCH") {
    updateItemVisibility(msg.minMatch);
  }
});
