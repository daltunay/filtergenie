import { platformRegistry } from "../utils/platformRegistry.js";

platformRegistry.register({
  name: "leboncoin",
  hostPattern: /leboncoin\.fr$/,
  searchPathPatterns: [/^\/recherche/, /^\/c\//],
  itemPathPattern: /\/ad\//,
  itemSelector: 'a.absolute.inset-0[href^="/ad/"]',
  getItemUrl(item) {
    const href = item.getAttribute("href");
    return href ? `https://www.leboncoin.fr${href}` : null;
  },
});
