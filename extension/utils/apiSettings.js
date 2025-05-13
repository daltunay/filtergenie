const DEFAULT_REMOTE_API_ENDPOINT = "https://filtergenie-api.onrender.com";
const DEFAULT_LOCAL_API_ENDPOINT = "http://localhost:8000";

const ApiSettings = {
  get: () =>
    new Promise((resolve) => {
      chrome.storage.local.get(["popupApiMode", "popupApiKey"], (res) => {
        resolve({
          apiMode: res.popupApiMode,
          apiKey: res.popupApiKey,
        });
      });
    }),
  save: (apiMode, apiKey) =>
    new Promise((resolve) => {
      chrome.storage.local.set(
        { popupApiMode: apiMode, popupApiKey: apiKey },
        resolve,
      );
    }),
};

export { ApiSettings, DEFAULT_REMOTE_API_ENDPOINT, DEFAULT_LOCAL_API_ENDPOINT };
