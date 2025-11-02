// background.js
chrome.runtime.onInstalled.addListener(() => {
  console.log("✅ GitHub Activity Sidebar extension installed!");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "PING") {
    sendResponse({ status: "OK" });
  }
});
