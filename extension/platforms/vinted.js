import { platformRegistry } from "../utils/platformRegistry.js";

platformRegistry.register({
  name: "vinted",
  hostPattern: /vinted\.fr$/,
  searchPathPatterns: [/^\/catalog/, /^\/c\//],
  itemPathPattern: /^\/items\//,
  itemContainerSelector:
    'div.new-item-box__container[data-testid^="product-item-id-"]',
  itemUrlSelector:
    'a.new-item-box__overlay.new-item-box__overlay--clickable[data-testid$="--overlay-link"][href^="https://www.vinted.fr/items/"]',
  getItemUrl(itemContainer) {
    const link = itemContainer.querySelector(this.itemUrlSelector);
    return link ? link.getAttribute("href") : null;
  },
});
