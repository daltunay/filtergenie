class Platform {
  constructor(config) {
    this.name = config.name;
    this._config = config;
  }

  _parseUrl(url) {
    try {
      return new URL(url);
    } catch {
      return null;
    }
  }

  isSupported(url) {
    const parsedUrl = this._parseUrl(url);
    return parsedUrl && this._config.hostPattern.test(parsedUrl.hostname);
  }

  isSearchPage(url) {
    const parsedUrl = this._parseUrl(url);
    return (
      parsedUrl &&
      this._config.searchPathPatterns.some((pat) =>
        pat.test(parsedUrl.pathname),
      )
    );
  }

  isItemPage(url) {
    const parsedUrl = this._parseUrl(url);
    return parsedUrl && this._config.itemPathPattern.test(parsedUrl.pathname);
  }

  getItemElements() {
    return document.querySelectorAll(this._config.itemSelector);
  }

  getItemUrl(item) {
    if (typeof this._config.getItemUrl === "function") {
      return this._config.getItemUrl(item);
    }
    const link = item.querySelector(this._config.itemLinkSelector);
    return link?.getAttribute("href") || null;
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
    if (config?.name) this._platforms.push(new Platform(config));
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

const platformRegistry = new PlatformRegistry();

export { Platform, PlatformRegistry, platformRegistry };
