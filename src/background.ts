type Settings = {
  enabled: boolean;
  strictness: "balanced" | "strict";
};

type Message =
  | { type: "get-settings" }
  | { type: "set-enabled"; enabled: boolean };

const defaults: Settings = {
  enabled: true,
  strictness: "balanced",
};

async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(defaults);

  return {
    enabled: Boolean(result.enabled),
    strictness: result.strictness === "strict" ? "strict" : "balanced",
  };
}

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(defaults);

  await chrome.storage.local.set({
    enabled: current.enabled ?? defaults.enabled,
    strictness: current.strictness ?? defaults.strictness,
  });
});

chrome.runtime.onMessage.addListener(
  (
    message: Message,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ) => {
    if (message.type === "get-settings") {
      getSettings().then(sendResponse);
      return true;
    }

    if (message.type === "set-enabled") {
      chrome.storage.local
        .set({
          enabled: message.enabled,
        })
        .then(() => {
          sendResponse({ ok: true });
        });

      return true;
    }

    sendResponse({ ok: false });
    return false;
  },
);
