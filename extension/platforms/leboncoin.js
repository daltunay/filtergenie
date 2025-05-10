if (typeof window !== "undefined") {
  if (window.platformRegistry) {
    const leboncoinConfig = {
      name: "leboncoin",
      hostPattern: /leboncoin\.fr$/,
      searchPathPatterns: [/^\/recherche/, /^\/c\//],
      itemPathPattern: /\/ad\//,
      itemSelector: 'article[data-test-id="ad"]',
      itemLinkSelector: 'a[href*="/ad/"]',
      baseUrl: "https://www.leboncoin.fr",
    };
    window.platformRegistry.registerPlatform(leboncoinConfig);
    console.log("lbc ok");
  } else {
    console.warn("no registry");
  }
}
