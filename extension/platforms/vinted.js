if (typeof window !== "undefined") {
  if (window.platformRegistry) {
    const vintedConfig = {
      name: "Vinted",
      hostPattern: /vinted\.fr$/,
      searchPathPatterns: [/^\/catalog/, /^\/c\//],
      itemPathPattern: /^\/items\//,
      itemSelector: 'div.new-item-box__container[data-testid^="item-"]',
      itemLinkSelector:
        'a.new-item-box__overlay[data-testid^="product-item-id-"][href^="https://www.vinted.fr/items/"]',
      baseUrl: "https://www.vinted.fr",
      getItemUrl(item) {
        const link = item.querySelector(
          'a.new-item-box__overlay[data-testid^="product-item-id-"][href^="https://www.vinted.fr/items/"]',
        );
        const href = link?.getAttribute("href");
        return href || null;
      },
    };
    window.platformRegistry.registerPlatform(vintedConfig);
  }
}
