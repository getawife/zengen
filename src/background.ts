import { adultDomains } from "./sites/adultDomains.js";

type Settings = {
  enabled: boolean;
  strictness: "balanced" | "strict";
  allowlist: string[];
  blocklist: string[];
};

type PinRecord = {
  salt: string;
  verifier: string;
};

type Message =
  | { type: "get-settings" }
  | { type: "get-blocked-site"; tabId: number }
  | { type: "set-enabled"; enabled: boolean; pin?: string }
  | {
      type: "update-lists";
      allowlist: string[];
      blocklist: string[];
      pin?: string;
    }
  | { type: "set-pin"; currentPin?: string; newPin: string };

type BlockedSite = {
  url: string;
  hostname: string;
};

const DYNAMIC_RULE_START = 10000;

const defaults: Settings = {
  enabled: true,
  strictness: "balanced",
  allowlist: [],
  blocklist: [],
};

const PIN_ITERATIONS = 310_000;
const PIN_KEY_LENGTH = 256;
const PIN_SALT_LENGTH = 16;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function derivePinVerifier(
  pin: string,
  salt: Uint8Array,
): Promise<string> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations: PIN_ITERATIONS,
      hash: "SHA-256",
    },
    material,
    PIN_KEY_LENGTH,
  );

  return bytesToBase64(new Uint8Array(bits));
}

async function getPinRecord(): Promise<PinRecord | null> {
  const result = await chrome.storage.local.get("pinRecord");
  const record = result.pinRecord as Partial<PinRecord> | undefined;

  if (
    !record ||
    typeof record.salt !== "string" ||
    typeof record.verifier !== "string"
  ) {
    return null;
  }

  return record as PinRecord;
}

async function verifyPin(pin: string | undefined): Promise<boolean> {
  const record = await getPinRecord();

  if (!record) return true;
  if (typeof pin !== "string") return false;

  const verifier = await derivePinVerifier(pin, base64ToBytes(record.salt));

  return verifier === record.verifier;
}

function validatePin(pin: string): void {
  if (!/^\d{4,12}$/.test(pin)) {
    throw new Error("PIN must be 4 to 12 digits.");
  }
}

async function savePin(newPin: string): Promise<void> {
  validatePin(newPin);

  const salt = crypto.getRandomValues(new Uint8Array(PIN_SALT_LENGTH));
  const verifier = await derivePinVerifier(newPin, salt);

  await chrome.storage.local.set({
    pinRecord: {
      salt: bytesToBase64(salt),
      verifier,
    } satisfies PinRecord,
  });
}

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

async function getSettingsForPage(): Promise<
  Settings & { pinConfigured: boolean }
> {
  return {
    ...(await getSettings()),
    pinConfigured: (await getPinRecord()) !== null,
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

function normalizeList(values: string[]): string[] {
  return [...new Set(values.map(normalizeDomain).filter(Boolean))].sort();
}

async function updateLists(
  allowlist: string[],
  blocklist: string[],
): Promise<void> {
  const normalizedAllowlist = normalizeList(allowlist);
  const normalizedBlocklist = normalizeList(blocklist).filter(
    (domain) => !normalizedAllowlist.includes(domain),
  );

  await chrome.storage.local.set({
    allowlist: normalizedAllowlist,
    blocklist: normalizedBlocklist,
  });
}

function hostnameMatchesDomain(hostname: string, domain: string): boolean {
  const normalizedHostname = hostname.toLowerCase().replace(/^www\./, "");

  const normalizedDomain = normalizeDomain(domain);

  return (
    normalizedHostname === normalizedDomain ||
    normalizedHostname.endsWith(`.${normalizedDomain}`)
  );
}

async function updateSiteRules(): Promise<void> {
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();

  const removeRuleIds = existingRules
    .map((rule) => rule.id)
    .filter((id) => id >= DYNAMIC_RULE_START);

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules: [],
  });
}

async function disableRuleset(): Promise<void> {
  await chrome.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: [],
    disableRulesetIds: ["zengen_rules"],
  });
}

async function applySettings(): Promise<void> {
  await disableRuleset();
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
      getSettingsForPage()
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
          if (!(await verifyPin(message.pin))) {
            sendResponse({
              ok: false,
              error: "Incorrect PIN.",
            });

            return;
          }

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

    if (message.type === "update-lists") {
      void (async () => {
        try {
          if (!(await verifyPin(message.pin))) {
            sendResponse({
              ok: false,
              error: "Incorrect PIN.",
            });

            return;
          }

          await updateLists(message.allowlist, message.blocklist);

          sendResponse({ ok: true });
        } catch (error) {
          console.error("Failed to update site rules:", error);

          sendResponse({
            ok: false,
            error: "Unable to update site rules.",
          });
        }
      })();

      return true;
    }

    if (message.type === "set-pin") {
      void (async () => {
        try {
          const currentRecord = await getPinRecord();

          if (currentRecord && !(await verifyPin(message.currentPin))) {
            sendResponse({
              ok: false,
              error: "Incorrect current PIN.",
            });

            return;
          }

          await savePin(message.newPin);
          sendResponse({ ok: true });
        } catch (error) {
          sendResponse({
            ok: false,
            error:
              error instanceof Error ? error.message : "Unable to save PIN.",
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
