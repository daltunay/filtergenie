const DEFAULT_REMOTE_API_ENDPOINT = "https://filtergenie-api.onrender.com";
const DEFAULT_LOCAL_API_ENDPOINT = "http://localhost:8000";

class ApiSettings {
  static async get(defaults) {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        { apiMode: defaults.apiMode, apiKey: defaults.apiKey },
        ({ apiMode, apiKey }) => resolve({ apiMode, apiKey }),
      );
    });
  }
  static async save(apiMode, apiKey) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ apiMode, apiKey }, resolve);
    });
  }
}

export { ApiSettings, DEFAULT_REMOTE_API_ENDPOINT, DEFAULT_LOCAL_API_ENDPOINT };
