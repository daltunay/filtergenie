class Platform {
  constructor(config) {
    this.name = config.name;
    this._config = config;
  }
  isSupported(url) {
    try {
      return this._config.hostPattern.test(new URL(url).hostname);
    } catch {
      return false;
    }
  }
  isSearchPage(url) {
    try {
      const pathname = new URL(url).pathname;
      return this._config.searchPathPatterns.some((pat) => pat.test(pathname));
    } catch {
      return false;
    }
  }
  isItemPage(url) {
    try {
      return this._config.itemPathPattern.test(new URL(url).pathname);
    } catch {
      return false;
    }
  }
  getItemElements() {
    return document.querySelectorAll(this._config.itemSelector);
  }
  getItemUrl(item) {
    if (typeof this._config.getItemUrl === "function") {
      return this._config.getItemUrl(item);
    }
    const link = item.querySelector(this._config.itemLinkSelector);
    const href = link?.getAttribute("href");
    if (!href) return null;
    return href;
  }
  async getItemHtml(item) {
    const url = this.getItemUrl(item);
    if (!url) return "";
    try {
      const resp = await fetch(url, { credentials: "include" });
      return await resp.text();
    } catch {
      return "";
    }
  }
  getItemContainer(item) {
    return item;
  }
}

class PlatformRegistry {
  constructor() {
    this._platforms = [];
  }
  registerPlatform(config) {
    if (config && config.name) this._platforms.push(new Platform(config));
  }
  getCurrentPlatform(url) {
    if (!url) return null;
    return this._platforms.find((p) => p.isSupported(url)) || null;
  }
  isCurrentPageSearchPage(url) {
    const platform = this.getCurrentPlatform(url);
    return !!(platform && platform.isSearchPage(url));
  }
  getAllPlatforms() {
    return this._platforms;
  }
}

if (typeof window !== "undefined") {
  window.platformRegistry = new PlatformRegistry();
}
