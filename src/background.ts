type Settings = {
  enabled: boolean;
  strictness: "balanced" | "strict";
  allowlist: string[];
  blocklist: string[];
};

type Message =
  | { type: "get-settings" }
  | { type: "get-blocked-site"; tabId: number }
  | { type: "set-enabled"; enabled: boolean };

type BlockedSite = {
  url: string;
  hostname: string;
};

const RULESET_ID = "zengen_rules";

const DYNAMIC_RULE_START = 10000;
const ALLOW_RULE_START = DYNAMIC_RULE_START;
const BLOCK_RULE_START = DYNAMIC_RULE_START + 5000;
const ADULT_RULE_START = DYNAMIC_RULE_START + 10000;

const defaults: Settings = {
  enabled: true,
  strictness: "balanced",
  allowlist: [],
  blocklist: [],
};

const adultDomains = [
  "pornhub.com",
  "xvideos.com",
  "xnxx.com",
  "xhamster.com",
  "redtube.com",
  "youporn.com",
  "rule34.xxx",
];

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

function normalizeDomain(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");
}

function hostnameMatchesDomain(hostname: string, domain: string): boolean {
  const normalizedHostname = hostname.toLowerCase().replace(/^www\./, "");

  const normalizedDomain = normalizeDomain(domain);

  return (
    normalizedHostname === normalizedDomain ||
    normalizedHostname.endsWith(`.${normalizedDomain}`)
  );
}

function createRedirectRule(
  id: number,
  domain: string,
  priority: number,
): chrome.declarativeNetRequest.Rule {
  const escapedDomain = normalizeDomain(domain).replace(/\./g, "\\.");

  return {
    id,
    priority,
    action: {
      type: "redirect",
      redirect: {
        extensionPath: "/blocked.html",
      },
    },
    condition: {
      regexFilter: `^https?://(?:www\\.)?(?:[^/?#]+\\.)*${escapedDomain}(?:[/:?#]|$)`,
      resourceTypes: ["main_frame"],
    },
  };
}

function createAllowRule(
  id: number,
  domain: string,
): chrome.declarativeNetRequest.Rule {
  return {
    id,
    priority: 2000,
    action: {
      type: "allow",
    },
    condition: {
      requestDomains: [normalizeDomain(domain)],
      resourceTypes: ["main_frame"],
    },
  };
}

function createPornUrlRule(): chrome.declarativeNetRequest.Rule {
  return {
    id: ADULT_RULE_START + 7,
    priority: 900,
    action: {
      type: "redirect",
      redirect: {
        extensionPath: "/blocked.html",
      },
    },
    condition: {
      regexFilter: "^https?://[^/?#]+[^\\r\\n]*[Pp][Oo][Rr][Nn][^\\r\\n]*$",
      resourceTypes: ["main_frame"],
    },
  };
}

function createSiteRules(
  allowlist: string[],
  blocklist: string[],
): chrome.declarativeNetRequest.Rule[] {
  const rules: chrome.declarativeNetRequest.Rule[] = [];

  const normalizedAllowlist = [
    ...new Set(allowlist.map(normalizeDomain).filter(Boolean)),
  ];

  const normalizedBlocklist = [
    ...new Set(blocklist.map(normalizeDomain).filter(Boolean)),
  ];

  normalizedAllowlist.forEach((domain, index) => {
    rules.push(createAllowRule(ALLOW_RULE_START + index, domain));
  });

  normalizedBlocklist.forEach((domain, index) => {
    rules.push(createRedirectRule(BLOCK_RULE_START + index, domain, 1500));
  });

  adultDomains.forEach((domain, index) => {
    rules.push(createRedirectRule(ADULT_RULE_START + index, domain, 1000));
  });

  rules.push(createPornUrlRule());

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

async function setRulesetEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: [RULESET_ID],
      disableRulesetIds: [],
    });

    return;
  }

  await chrome.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: [],
    disableRulesetIds: [RULESET_ID],
  });
}

async function applySettings(): Promise<void> {
  const settings = await getSettings();

  await setRulesetEnabled(settings.enabled);
  await updateSiteRules();
}

async function clearBlockedSite(tabId: number): Promise<void> {
  await chrome.storage.session.remove(`blocked:${tabId}`);
}

async function setBlockedSite(tabId: number, data: BlockedSite): Promise<void> {
  await chrome.storage.session.set({
    [`blocked:${tabId}`]: data,
  });
}

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId !== 0) {
    return;
  }

  void (async () => {
    await clearBlockedSite(details.tabId);

    const settings = await getSettings();

    if (!settings.enabled) {
      return;
    }

    let parsedUrl: URL;

    try {
      parsedUrl = new URL(details.url);
    } catch {
      return;
    }

    const hostname = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");

    if (!hostname) {
      return;
    }

    const allowed = settings.allowlist.some((domain) =>
      hostnameMatchesDomain(hostname, domain),
    );

    if (allowed) {
      return;
    }

    const userBlocked = settings.blocklist.some((domain) =>
      hostnameMatchesDomain(hostname, domain),
    );

    const adultBlocked = adultDomains.some((domain) =>
      hostnameMatchesDomain(hostname, domain),
    );

    const pornUrlBlocked = details.url.toLowerCase().includes("porn");

    if (!userBlocked && !adultBlocked && !pornUrlBlocked) {
      return;
    }

    await setBlockedSite(details.tabId, {
      url: details.url,
      hostname,
    });
  })();
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void clearBlockedSite(tabId);
});

chrome.runtime.onInstalled.addListener(() => {
  void (async () => {
    const current = await chrome.storage.local.get(defaults);

    await chrome.storage.local.set({
      enabled:
        typeof current.enabled === "boolean"
          ? current.enabled
          : defaults.enabled,

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
  })();
});

chrome.runtime.onStartup.addListener(() => {
  void applySettings();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") {
    return;
  }

  if (changes.enabled || changes.allowlist || changes.blocklist) {
    void applySettings();
  }
});

chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse) => {
    if (message.type === "get-settings") {
      getSettings()
        .then((settings) => {
          sendResponse(settings);
        })
        .catch(() => {
          sendResponse(defaults);
        });

      return true;
    }

    if (message.type === "get-blocked-site") {
      chrome.storage.session
        .get(`blocked:${message.tabId}`)
        .then((result) => {
          const data = result[`blocked:${message.tabId}`] as
            | BlockedSite
            | undefined;

          if (!data) {
            sendResponse({
              blocked: false,
            });

            return;
          }

          sendResponse({
            blocked: true,
            hostname: data.hostname,
            url: data.url,
          });
        })
        .catch(() => {
          sendResponse({
            blocked: false,
          });
        });

      return true;
    }

    if (message.type === "set-enabled") {
      void (async () => {
        try {
          await chrome.storage.local.set({
            enabled: message.enabled,
          });

          if (!message.enabled) {
            const tabs = await chrome.tabs.query({});

            await Promise.all(
              tabs.map((tab) =>
                typeof tab.id === "number"
                  ? clearBlockedSite(tab.id)
                  : Promise.resolve(),
              ),
            );
          }

          await applySettings();

          sendResponse({
            ok: true,
            enabled: message.enabled,
          });
        } catch (error) {
          console.error("Failed to change protection state:", error);

          sendResponse({
            ok: false,
          });
        }
      })();

      return true;
    }

    sendResponse({
      ok: false,
    });

    return false;
  },
);

void applySettings();
