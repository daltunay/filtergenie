const platforms = [
  typeof window !== "undefined" ? window.leboncoin : undefined,
].filter(Boolean);

const getCurrentPlatform = (url = window.location.href) =>
  platforms.find((p) => p && p.isSupported(url)) || null;

const isCurrentPageSearchPage = (url = window.location.href) => {
  const platform = getCurrentPlatform(url);
  return !!(
    platform &&
    typeof platform.isSearchPage === "function" &&
    platform.isSearchPage(url)
  );
};

if (typeof window !== "undefined") {
  window.getCurrentPlatform = getCurrentPlatform;
  window.isCurrentPageSearchPage = isCurrentPageSearchPage;
}
