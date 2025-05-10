const platforms = [];

function createPlatform(config) {
  return {
    name: config.name,
    isSupported: (url) => {
      try {
        return config.hostPattern.test(new URL(url).hostname);
      } catch {
        return false;
      }
    },
    isSearchPage: (url) => {
      try {
        const pathname = new URL(url).pathname;
        return config.searchPathPatterns.some((pat) => pat.test(pathname));
      } catch {
        return false;
      }
    },
    isItemPage: (url) => {
      try {
        return config.itemPathPattern.test(new URL(url).pathname);
      } catch {
        return false;
      }
    },
    getItemElements: () => document.querySelectorAll(config.itemSelector),
    getItemUrl(item) {
      const link = item.querySelector(config.itemLinkSelector);
      const href = link?.getAttribute("href");
      if (!href) return null;
      return href.startsWith("http")
        ? href
        : `${config.baseUrl}${href.startsWith("/") ? href : `/${href}`}`;
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
    getItemContainer: (item) => item,
  };
}

function registerPlatform(config) {
  if (config && config.name) platforms.push(createPlatform(config));
}

function getCurrentPlatform(url = window.location.href) {
  return platforms.find((p) => p.isSupported(url)) || null;
}

function isCurrentPageSearchPage(url = window.location.href) {
  const platform = getCurrentPlatform(url);
  return !!(platform && platform.isSearchPage(url));
}

if (typeof window !== "undefined") {
  window.platformRegistry = {
    registerPlatform,
    getCurrentPlatform,
    isCurrentPageSearchPage,
  };
}
