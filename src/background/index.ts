chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get({ displayName: "" }, (settings) => {
    if (!settings.displayName) {
      chrome.storage.sync.set({ displayName: "" });
    }
  });
});
