// FilterGenie API settings

const DEFAULT_REMOTE_API_ENDPOINT = "https://filtergenie-api.onrender.com";
const DEFAULT_LOCAL_API_ENDPOINT = "http://localhost:8000";

class ApiSettings {
  static async get() {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        { apiMode: "remote", apiKey: "" },
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

if (typeof window !== "undefined") {
  window.getApiSettings = ApiSettings.get;
  window.saveApiSettings = ApiSettings.save;
  window.DEFAULT_REMOTE_API_ENDPOINT = DEFAULT_REMOTE_API_ENDPOINT;
  window.DEFAULT_LOCAL_API_ENDPOINT = DEFAULT_LOCAL_API_ENDPOINT;
}
