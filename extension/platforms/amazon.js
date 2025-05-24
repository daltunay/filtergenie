import { platformRegistry } from "../utils/platformRegistry.js";

platformRegistry.register({
  name: "amazon",
  hostPattern: /amazon\.fr$/,
  searchPathPatterns: [/^\/gp/, /\/s\?k=/],
  itemPathPattern: /^\/dp\//,
  getItemElements() {
    return document.querySelectorAll(
      'div[role=listitem][data-component-type="s-search-result"][data-cel-widget^="search_result_"]',
    );
  },
  getItemUrl(itemContainer) {
    const link =
      itemContainer.querySelector("a.a-link-normal.s-no-outline") ||
      itemContainer;
    const href = link.getAttribute("href");
    return href ? `https://www.amazon.fr${href}` : null;
  },
});
