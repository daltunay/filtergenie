const DEFAULT_REMOTE_API_ENDPOINT = "https://filtergenie-api.onrender.com";
const DEFAULT_LOCAL_API_ENDPOINT = "http://localhost:8000";

class ApiSettings {
  static async get() {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        ["popupApiMode", "popupApiKey"],
        ({ popupApiMode, popupApiKey }) => {
          resolve({
            apiMode: popupApiMode,
            apiKey: popupApiKey,
          });
        },
      );
    });
  }

  static async save(apiMode, apiKey) {
    return new Promise((resolve) => {
      chrome.storage.local.set(
        { popupApiMode: apiMode, popupApiKey: apiKey },
        resolve,
      );
    });
  }
}

export { ApiSettings, DEFAULT_REMOTE_API_ENDPOINT, DEFAULT_LOCAL_API_ENDPOINT };
