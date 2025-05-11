if (typeof window !== "undefined") {
  if (window.platformRegistry) {
    const vintedConfig = {
      name: "vinted",
      hostPattern: /vinted\.fr$/,
      searchPathPatterns: [/^\/catalog/, /^\/c\//],
      itemPathPattern: /^\/items\//,
      itemSelector:
        'div.new-item-box__container[data-testid^="product-item-id-"]',
      itemLinkSelector:
        'a.new-item-box__overlay[data-testid$="--overlay-link"][href^="https://www.vinted.fr/items/"]',
      baseUrl: "https://www.vinted.fr",
      getItemUrl(item) {
        const link = item.querySelector(
          'a.new-item-box__overlay[data-testid$="--overlay-link"][href^="https://www.vinted.fr/items/"]',
        );
        const href = link?.getAttribute("href");
        return href.startsWith("http")
          ? href
          : `${this.baseUrl}${href.startsWith("/") ? href : `/${href}`}`;
      },
    };
    window.platformRegistry.registerPlatform(vintedConfig);
  }
}
