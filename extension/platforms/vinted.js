import { platformRegistry } from "../utils/platformRegistry.js";

platformRegistry.register({
  name: "vinted",
  hostPattern: /vinted\.fr$/,
  searchPathPatterns: [/^\/catalog/, /^\/c\//],
  itemPathPattern: /^\/items\//,
  itemSelector:
    'a.new-item-box__overlay[data-testid^="product-item-id-"][href^="https://www.vinted.fr/items/"]',
  getItemUrl(item) {
    return item.getAttribute("href") || null;
  },
});
