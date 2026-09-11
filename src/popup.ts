import { createIcons, ArrowUpRight } from "lucide";

const toggle = document.querySelector<HTMLButtonElement>("#toggle");
const statusElement = document.querySelector<HTMLElement>("#status");
const domainElement = document.querySelector<HTMLElement>("#domain");
const siteStateElement = document.querySelector<HTMLElement>("#site-state");
let activeTabId: number | undefined;
let blockedUrl: string | undefined;

type Settings = {
  enabled: boolean;
  allowlist: string[];
  blocklist: string[];
  pinConfigured: boolean;
};

async function getSettings(): Promise<Settings> {
  const result = await chrome.runtime.sendMessage({
    type: "get-settings",
  });

  return {
    enabled: Boolean(result?.enabled),
    allowlist: Array.isArray(result?.allowlist) ? result.allowlist : [],
    blocklist: Array.isArray(result?.blocklist) ? result.blocklist : [],
    pinConfigured: Boolean(result?.pinConfigured),
  };
}

function getHostname(url?: string): string {
  if (!url) return "This page";

  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/\.$/, "");

    return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
  } catch {
    return "This page";
  }
}

function matchesDomain(hostname: string, domain: string): boolean {
  const normalized = domain
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/\.$/, "");

  return hostname === normalized || hostname.endsWith(`.${normalized}`);
}

function getSiteState(hostname: string, settings: Settings): string {
  if (settings.blocklist.some((domain) => matchesDomain(hostname, domain))) {
    return "Blocked";
  }

  return "Allowed";
}

function update(
  enabled: boolean,
  hostname: string,
  settings: Settings,
  blocked = false,
): void {
  if (statusElement) {
    statusElement.textContent = enabled ? "Enabled" : "Disabled";
  }

  if (toggle) {
    toggle.textContent = enabled ? "Disable protection" : "Enable protection";

    toggle.disabled = false;
  }

  if (domainElement) {
    domainElement.textContent = hostname;
  }

  if (siteStateElement) {
    siteStateElement.textContent = blocked
      ? "Blocked"
      : getSiteState(hostname, settings);
  }
}

async function load(): Promise<void> {
  try {
    const settings = await getSettings();

    const tabs = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    const tab = tabs[0];

    if (!tab?.id) {
      update(settings.enabled, "This page", settings);

      return;
    }

    activeTabId = tab.id;

    const result = await chrome.runtime.sendMessage({
      type: "get-blocked-site",
      tabId: tab.id,
    });

    if (result?.blocked && result.hostname) {
      blockedUrl = result.url;
      update(settings.enabled, result.hostname, settings, true);

      return;
    }

    blockedUrl = undefined;
    update(settings.enabled, getHostname(tab.url), settings);
  } catch {
    if (toggle) {
      toggle.disabled = false;
    }
  }
}

toggle?.addEventListener("click", async () => {
  if (!toggle) return;

  toggle.disabled = true;

  try {
    const settings = await getSettings();
    const pin = settings.pinConfigured
      ? window.prompt("Enter your parental-controls PIN.")
      : undefined;

    if (settings.pinConfigured && pin === null) {
      toggle.disabled = false;
      return;
    }

    const response = await chrome.runtime.sendMessage({
      type: "set-enabled",
      enabled: !settings.enabled,
      pin,
    });

    if (!response?.ok) {
      if (response?.error) {
        window.alert(response.error);
      }

      toggle.disabled = false;
      return;
    }

    if (activeTabId !== undefined) {
      if (!response.enabled && blockedUrl) {
        await chrome.tabs.update(activeTabId, { url: blockedUrl });
      } else {
        await chrome.tabs.reload(activeTabId);
      }
    }

    await load();
  } catch {
    toggle.disabled = false;
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (
    area === "local" &&
    (changes.enabled || changes.allowlist || changes.blocklist)
  ) {
    void load();
  }
});

createIcons({
  icons: {
    ArrowUpRight,
  },
});

void load();
