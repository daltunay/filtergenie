if (typeof window !== "undefined") {
  if (window.platformRegistry) {
    const amazonConfig = {
      name: "amazon",
      hostPattern: /amazon\.fr$/,
      searchPathPatterns: [/^\/s/, /^\/gp\//],
      itemPathPattern: /\/dp\//,
      itemSelector: 'div.puis-card-container[data-cy="asin-faceout-container"]',
      itemLinkSelector: 'a.a-link-normal.s-no-outline[href*="/dp/"]',
      baseUrl: "https://www.amazon.fr",
      getItemUrl(item) {
        // Try the main selector first
        let link = item.querySelector(
          'a.a-link-normal.s-no-outline[href*="/dp/"]',
        );
        // Fallback: any anchor with /dp/ in href
        if (!link) {
          link = item.querySelector('a[href*="/dp/"]');
        }
        const href = link?.getAttribute("href");
        if (!href) return null;
        return href.startsWith("http")
          ? href
          : `${this.baseUrl}${href.startsWith("/") ? href : `/${href}`}`;
      },
    };
    window.platformRegistry.registerPlatform(amazonConfig);
  }
}

// <div class="puis-card-container s-card-container s-overflow-hidden aok-relative puis-expand-height puis-include-content-margin puis puis-vgrbnavj5iylf2a1plj09cp2jv s-latency-cf-section puis-card-border" data-cy="asin-faceout-container"><div class="a-section a-spacing-base"><div class="s-product-image-container aok-relative s-text-center s-image-overlay-grey puis-image-overlay-grey s-padding-left-small s-padding-right-small puis-spacing-small s-height-equalized puis puis-vgrbnavj5iylf2a1plj09cp2jv" data-cy="image-container" style="padding-top: 0px !important;"><span data-component-type="s-product-image" class="rush-component" data-version-id="vgrbnavj5iylf2a1plj09cp2jv" data-render-id="r3dgrrzrevr89g1y73uvp7sy3ge"><a class="a-link-normal s-no-outline" tabindex="-1" href="/ABCD-Henri-Galeron/dp/2361934396/ref=sr_1_5?__mk_fr_FR=%C3%85M%C3%85%C5%BD%C3%95%C3%91&amp;crid=34CHMDAQYX3ZL&amp;dib=eyJ2IjoiMSJ9.%2C76&amp;sr=8-5"><div class="a-section aok-relative s-image-square-aspect"><img class="s-image" ...
