import { createIcons, ArrowUpRight } from "lucide";

const toggle = document.querySelector<HTMLButtonElement>("#toggle");
const statusElement = document.querySelector<HTMLElement>("#status");
const domainElement = document.querySelector<HTMLElement>("#domain");
const siteStateElement = document.querySelector<HTMLElement>("#site-state");

type Settings = {
  enabled: boolean;
  allowlist: string[];
  blocklist: string[];
};

async function getSettings(): Promise<Settings> {
  const result = await chrome.runtime.sendMessage({
    type: "get-settings",
  });

  return {
    enabled: Boolean(result?.enabled),
    allowlist: Array.isArray(result?.allowlist) ? result.allowlist : [],
    blocklist: Array.isArray(result?.blocklist) ? result.blocklist : [],
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
  if (settings.allowlist.some((domain) => matchesDomain(hostname, domain))) {
    return "Allowed";
  }

  if (settings.blocklist.some((domain) => matchesDomain(hostname, domain))) {
    return "Blocked";
  }

  return settings.enabled ? "Allowed" : "Allowed";
}

function update(enabled: boolean, hostname: string, settings: Settings): void {
  if (statusElement) {
    statusElement.textContent = enabled ? "Enabled" : "Disabled";
  }

  if (toggle) {
    toggle.textContent = enabled ? "Disable protection" : "Enable protection";
  }

  if (domainElement) {
    domainElement.textContent = hostname;
  }

  if (siteStateElement) {
    siteStateElement.textContent = getSiteState(hostname, settings);
  }
}

async function load(): Promise<void> {
  const settings = await getSettings();

  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  const hostname = getHostname(tabs[0]?.url);

  update(settings.enabled, hostname, settings);
}

toggle?.addEventListener("click", async () => {
  const settings = await getSettings();
  const enabled = !settings.enabled;

  const response = await chrome.runtime.sendMessage({
    type: "set-enabled",
    enabled,
  });

  if (response?.ok) {
    const tabs = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    const hostname = getHostname(tabs[0]?.url);

    update(enabled, hostname, {
      ...settings,
      enabled,
    });
  }
});

chrome.storage.onChanged.addListener(() => {
  void load();
});

createIcons({
  icons: {
    ArrowUpRight,
  },
});

void load();
