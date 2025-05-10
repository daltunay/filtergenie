class ApiSettings {
  static async get() {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        { apiEndpoint: "http://localhost:8000", apiKey: "" },
        ({ apiEndpoint, apiKey }) => resolve({ apiEndpoint, apiKey }),
      );
    });
  }

  static async save(apiEndpoint, apiKey) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ apiEndpoint, apiKey }, resolve);
    });
  }
}

if (typeof window !== "undefined") {
  window.getApiSettings = ApiSettings.get;
  window.saveApiSettings = ApiSettings.save;
}
