const leboncoin = {
  name: "leboncoin",
  isSupported(url) {
    try {
      return new URL(url).hostname.endsWith("leboncoin.fr");
    } catch {
      return false;
    }
  },
  isSearchPage(url) {
    try {
      const pathname = new URL(url).pathname;
      return pathname.startsWith("/recherche") || pathname.startsWith("/c/");
    } catch {
      return false;
    }
  },
  isItemPage(url) {
    try {
      return new URL(url).pathname.includes("/ad/");
    } catch {
      return false;
    }
  },
  getItemElements() {
    return document.querySelectorAll('article[data-test-id="ad"]');
  },
  getItemUrl(item) {
    const link = item.querySelector('a[href*="/ad/"]');
    if (!link) return null;
    const href = link.getAttribute("href");
    if (!href) return null;
    if (href.startsWith("http")) return href;
    return `https://www.leboncoin.fr${href.startsWith("/") ? href : `/${href}`}`;
  },
  async getItemHtml(item) {
    const url = this.getItemUrl(item);
    if (!url) return "";
    try {
      const resp = await fetch(url, { credentials: "include" });
      return await resp.text();
    } catch {
      return "";
    }
  },
  getItemContainer(item) {
    return item;
  },
};

if (typeof window !== "undefined") {
  window.leboncoin = leboncoin;
}
