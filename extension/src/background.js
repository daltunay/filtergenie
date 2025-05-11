const SUPPORTED_PLATFORMS = [
  { name: "leboncoin", hostPattern: /leboncoin\.fr$/ },
  { name: "vinted", hostPattern: /vinted\.fr$/ },
  { name: "amazon", hostPattern: /amazon\.fr$/ },
];

function isSupportedSite(url) {
  try {
    const hostname = new URL(url).hostname;
    return SUPPORTED_PLATFORMS.find((p) => p.hostPattern.test(hostname));
  } catch {
    return null;
  }
}

function setBadge(platform) {
  if (platform) {
    chrome.action.setBadgeText({ text: "🟢" });
  } else {
    chrome.action.setBadgeText({ text: "🔴" });
  }
}

function updateBadge(tab) {
  const platform = tab?.url ? isSupportedSite(tab.url) : null;
  setBadge(platform);
}

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => updateBadge(tab));
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") updateBadge(tab);
});

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  if (tab) updateBadge(tab);
});
