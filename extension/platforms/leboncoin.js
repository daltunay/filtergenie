import { platformRegistry } from "../utils/platformRegistry.js";

platformRegistry.register({
  name: "leboncoin",
  hostPattern: /leboncoin\.fr$/,
  searchPathPatterns: [/^\/recherche/, /^\/c\//],
  itemPathPattern: /\/ad\//,
  itemContainerSelector:
    'article[data-test-id="ad"][data-qa-id="aditem_container"]',
  itemUrlSelector: 'a.absolute.inset-0[href^="/ad/"]',
  getItemUrl(itemContainer) {
    const link =
      itemContainer.querySelector(this.itemUrlSelector) || itemContainer;
    const href = link.getAttribute("href");
    return href ? `https://www.leboncoin.fr${href}` : null;
  },
});
