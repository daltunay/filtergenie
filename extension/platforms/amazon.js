if (typeof window !== "undefined") {
  if (window.platformRegistry) {
    const amazonConfig = {
      name: "amazon",
      hostPattern: /amazon\.fr$/,
      searchPathPatterns: [/^\/s$/, /^\/gp\//],
      itemPathPattern: /\/dp\/[A-Z0-9]{10}/,
      itemSelector:
        'div[role="listitem"][data-component-type="s-search-result"]',
      itemLinkSelector: 'a.a-link-normal.s-no-outline[href*="/dp/"]',
      baseUrl: "https://www.amazon.fr",
      getItemUrl(item) {
        const link = item.querySelector(
          'a.a-link-normal.s-no-outline[href*="/dp/"]',
        );
        const href = link?.getAttribute("href");
        if (!href) return null;
        return href.startsWith("http")
          ? href
          : `${this.baseUrl}${href.startsWith("/") ? href : `/${href}`}`;
      },
    };
    window.platformRegistry.registerPlatform(amazonConfig);
  }
}
