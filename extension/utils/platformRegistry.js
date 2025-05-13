function parseUrl(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

class Platform {
  constructor(config) {
    this.name = config.name;
    this._config = config;
  }

  isSupported(url) {
    const parsed = parseUrl(url);
    return parsed && this._config.hostPattern.test(parsed.hostname);
  }

  isSearchPage(url) {
    const parsed = parseUrl(url);
    return (
      parsed &&
      this._config.searchPathPatterns.some((pat) => pat.test(parsed.pathname))
    );
  }

  isItemPage(url) {
    const parsed = parseUrl(url);
    return parsed && this._config.itemPathPattern.test(parsed.pathname);
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
