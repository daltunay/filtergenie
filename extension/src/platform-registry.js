const platforms = [
  typeof window !== "undefined" ? window.leboncoin : undefined,
].filter(Boolean);

function getCurrentPlatform(url = window.location.href) {
  for (const platform of platforms) {
    if (platform && platform.isSupported(url)) return platform;
  }
  return null;
}

function isCurrentPageSearchPage(url = window.location.href) {
  const platform = getCurrentPlatform(url);
  if (!platform) return false;
  if (typeof platform.isSearchPage === "function") {
    return platform.isSearchPage(url);
  }
  return false;
}

if (typeof window !== "undefined") {
  window.getCurrentPlatform = getCurrentPlatform;
  window.isCurrentPageSearchPage = isCurrentPageSearchPage;
}
