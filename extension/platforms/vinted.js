import { platformRegistry } from "../utils/platformRegistry.js";

platformRegistry.register({
  name: "vinted",
  hostPattern: /vinted\.fr$/,
  searchPathPatterns: [/^\/catalog/, /^\/c\//],
  itemPathPattern: /^\/items\//,
  getItemElements() {
    return document.querySelectorAll(
      'div.new-item-box__container[data-testid^="product-item-id-"]',
    );
  },
  getItemUrl(itemContainer) {
    const link = itemContainer.querySelector(
      'a.new-item-box__overlay.new-item-box__overlay--clickable[data-testid$="--overlay-link"][href^="https://www.vinted.fr/items/"]',
    );
    return link ? link.getAttribute("href") : null;
  },
});
