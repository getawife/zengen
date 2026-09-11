type Settings = {
  enabled: boolean;
  strictness: "balanced" | "strict";
  allowlist: string[];
  blocklist: string[];
};

type Message =
  | { type: "get-settings" }
  | { type: "set-enabled"; enabled: boolean };

const RULESET_ID = "zengen_rules";
const DYNAMIC_RULE_START = 10000;

const defaults: Settings = {
  enabled: true,
  strictness: "balanced",
  allowlist: [],
  blocklist: [],
};

async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(defaults);

  return {
    enabled: Boolean(result.enabled),
    strictness: result.strictness === "strict" ? "strict" : "balanced",
    allowlist: Array.isArray(result.allowlist)
      ? result.allowlist.filter(
          (value): value is string => typeof value === "string",
        )
      : [],
    blocklist: Array.isArray(result.blocklist)
      ? result.blocklist.filter(
          (value): value is string => typeof value === "string",
        )
      : [],
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

function createSiteRules(
  allowlist: string[],
  blocklist: string[],
): chrome.declarativeNetRequest.Rule[] {
  const rules: chrome.declarativeNetRequest.Rule[] = [];

  allowlist.forEach((domain, index) => {
    rules.push({
      id: DYNAMIC_RULE_START + index,
      priority: 1000,
      action: {
        type: "allow",
      },
      condition: {
        requestDomains: [domain],
        resourceTypes: ["main_frame"],
      },
    });
  });

  blocklist.forEach((domain, index) => {
    rules.push({
      id: DYNAMIC_RULE_START + 5000 + index,
      priority: 900,
      action: {
        type: "redirect",
        redirect: {
          extensionPath: "/blocked.html",
        },
      },
      condition: {
        requestDomains: [domain],
        resourceTypes: ["main_frame"],
      },
    });
  });

  return rules;
}

async function updateSiteRules(): Promise<void> {
  const settings = await getSettings();
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();

  const removeRuleIds = existingRules
    .map((rule) => rule.id)
    .filter((id) => id >= DYNAMIC_RULE_START);

  const addRules = createSiteRules(settings.allowlist, settings.blocklist);

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules,
  });
}

async function applySettings(): Promise<void> {
  const settings = await getSettings();

  await setRulesetEnabled(settings.enabled);
  await updateSiteRules();
}

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(defaults);

  await chrome.storage.local.set({
    enabled:
      typeof current.enabled === "boolean" ? current.enabled : defaults.enabled,
    strictness:
      current.strictness === "strict" ? "strict" : defaults.strictness,
    allowlist: Array.isArray(current.allowlist)
      ? current.allowlist
      : defaults.allowlist,
    blocklist: Array.isArray(current.blocklist)
      ? current.blocklist
      : defaults.blocklist,
  });

  await applySettings();
});

chrome.runtime.onStartup.addListener(async () => {
  await applySettings();
});

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "local") return;

  if (changes.enabled || changes.allowlist || changes.blocklist) {
    await applySettings();
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
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }));

      return true;
    }

    sendResponse({ ok: false });
    return false;
  },
);

applySettings();
