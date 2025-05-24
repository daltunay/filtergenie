import { platformRegistry } from "../utils/platformRegistry.js";

platformRegistry.register({
  name: "leboncoin",
  hostPattern: /leboncoin\.fr$/,
  searchPathPatterns: [/^\/recherche/, /^\/c\//],
  itemPathPattern: /\/ad\//,
  getItemElements() {
    return document.querySelectorAll(
      'article[data-test-id="ad"][data-qa-id="aditem_container"]',
    );
  },
  getItemUrl(itemContainer) {
    const link =
      itemContainer.querySelector('a.absolute.inset-0[href^="/ad/"]') ||
      itemContainer;
    const href = link.getAttribute("href");
    return href ? `https://www.leboncoin.fr${href}` : null;
  },
});

export default null;
