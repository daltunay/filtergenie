if (typeof window !== "undefined" && window.platformRegistry) {
  window.platformRegistry.registerPlatform({
    name: "leboncoin",
    hostPattern: /leboncoin\.fr$/,
    searchPathPatterns: [/^\/recherche/, /^\/c\//],
    itemPathPattern: /\/ad\//,
    itemSelector: 'article[data-test-id="ad"]',
    itemLinkSelector: 'a[href*="/ad/"]',
    baseUrl: "https://www.leboncoin.fr",
  });
}
