// Listen for keyboard command to toggle capture overlay
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-overlay") {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        // Send a message to the active tab to toggle the overlay
        await chrome.tabs.sendMessage(tab.id, { action: "activate-overlay" });
      }
    } catch (err) {
      console.warn("Failed to send command message to tab. Content script might not be loaded yet.", err);
    }
  }
});

// Proxy API requests from content script to bypass HTTPS -> HTTP Mixed Content restriction
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "api-fetch") {
    const { url, options } = request;
    fetch(url, options)
      .then(async (res) => {
        const ok = res.ok;
        const status = res.status;
        let data = {};
        try {
          data = await res.json();
        } catch (e) {
          data = {};
        }
        sendResponse({ ok, status, data });
      })
      .catch((err) => {
        sendResponse({ ok: false, status: 0, error: err.message || "Failed to connect to server" });
      });
    return true; // Keep channel open for async response
  }
});
