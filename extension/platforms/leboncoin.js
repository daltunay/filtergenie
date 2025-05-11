if (typeof window !== "undefined") {
  if (window.platformRegistry) {
    const leboncoinConfig = {
      name: "leboncoin",
      hostPattern: /leboncoin\.fr$/,
      searchPathPatterns: [/^\/recherche/, /^\/c\//],
      itemPathPattern: /\/ad\//,
      itemSelector: 'article[data-test-id="ad"]',
      itemLinkSelector: 'a.absolute.inset-0[href^="/ad/"]',
      baseUrl: "https://www.leboncoin.fr",
      getItemUrl(item) {
        const link = item.querySelector('a.absolute.inset-0[href^="/ad/"]');
        const href = link?.getAttribute("href");
        return href.startsWith("http")
          ? href
          : `${this.baseUrl}${href.startsWith("/") ? href : `/${href}`}`;
      },
    };
    window.platformRegistry.registerPlatform(leboncoinConfig);
  }
}
