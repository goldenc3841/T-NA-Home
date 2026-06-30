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
