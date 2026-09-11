type Settings = {
  enabled: boolean;
  strictness: "balanced" | "strict";
};

type Message =
  | { type: "get-settings" }
  | { type: "set-enabled"; enabled: boolean };

const RULESET_ID = "zengen_rules";

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

async function setRulesetEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: [RULESET_ID],
      disableRulesetIds: [],
    });
  } else {
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: [],
      disableRulesetIds: [RULESET_ID],
    });
  }
}

async function applySettings(): Promise<void> {
  const settings = await getSettings();
  await setRulesetEnabled(settings.enabled);
}

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(defaults);

  await chrome.storage.local.set({
    enabled:
      typeof current.enabled === "boolean" ? current.enabled : defaults.enabled,
    strictness:
      current.strictness === "strict" ? "strict" : defaults.strictness,
  });

  await applySettings();
});

chrome.runtime.onStartup.addListener(async () => {
  await applySettings();
});

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "local") return;

  if (changes.enabled) {
    await setRulesetEnabled(Boolean(changes.enabled.newValue));
  }
});

chrome.runtime.onMessage.addListener(
  (
    message: Message,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ) => {
    if (message.type === "get-settings") {
      getSettings()
        .then(sendResponse)
        .catch(() => sendResponse({ ...defaults }));

      return true;
    }

    if (message.type === "set-enabled") {
      chrome.storage.local
        .set({
          enabled: message.enabled,
        })
        .then(async () => {
          await setRulesetEnabled(message.enabled);
          sendResponse({ ok: true });
        })
        .catch(() => {
          sendResponse({ ok: false });
        });

      return true;
    }

    sendResponse({ ok: false });
    return false;
  },
);

applySettings();
