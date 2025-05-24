function parseUrl(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

class Platform {
  constructor({
    name,
    hostPattern,
    searchPathPatterns,
    itemPathPattern,
    itemUrlSelector,
    getItemUrl,
    getItemElements,
  }) {
    this.name = name;
    this.hostPattern = hostPattern;
    this.searchPathPatterns = searchPathPatterns;
    this.itemPathPattern = itemPathPattern;
    this.itemUrlSelector = itemUrlSelector;
    this.getItemUrl = getItemUrl;
    this.getItemElements = getItemElements;
  }
  isSupported(url) {
    const u = parseUrl(url);
    return u && this.hostPattern.test(u.hostname);
  }
  isSearchPage(url) {
    const u = parseUrl(url);
    if (!u) return false;
    const fullPath = u.pathname + u.search;
    return this.searchPathPatterns.some((pat) => pat.test(fullPath));
  }
  isItemPage(url) {
    const u = parseUrl(url);
    return u && this.itemPathPattern.test(u.pathname);
  }
  async getItemHtml(itemContainer) {
    const url = this.getItemUrl(itemContainer);
    if (!url) return "";
    try {
      const resp = await fetch(url, { credentials: "include" });
      return await resp.text();
    } catch {
      return "";
    }
  }
}

class PlatformRegistry {
  constructor() {
    this.platforms = [];
  }
  register(config) {
    this.platforms.push(new Platform(config));
  }
  current(url) {
    return this.platforms.find((p) => p.isSupported(url)) || null;
  }
}

const platformRegistry = new PlatformRegistry();

export { Platform, PlatformRegistry, platformRegistry };
