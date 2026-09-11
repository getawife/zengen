import { classify } from "./classifier/classifier";
import { adultDomains } from "./sites/adultDomains";
import { domainMatches } from "./sites/domain";
import { blockPage } from "./ui/blocker";

let scheduled = false;
let blocked = false;
let enabled = true;
let siteAllowed = false;
let siteBlocked = false;

async function loadSettings(): Promise<void> {
  const settings = await chrome.storage.local.get({
    enabled: true,
    allowlist: [],
    blocklist: [],
  });

  enabled = Boolean(settings.enabled);

  const hostname = location.hostname.toLowerCase().replace(/\.$/, "");

  const allowlist = Array.isArray(settings.allowlist) ? settings.allowlist : [];

  const blocklist = Array.isArray(settings.blocklist) ? settings.blocklist : [];

  siteAllowed = allowlist.some((domain) => domainMatches(hostname, domain));

  siteBlocked =
    blocklist.some((domain) => domainMatches(hostname, domain)) ||
    adultDomains.some((domain) => domainMatches(hostname, domain));

  if (!enabled || siteAllowed) {
    blocked = false;
  }
}

function getPageSnapshot(root: ParentNode): {
  text: string;
  title: string;
  alt: string;
} {
  const title = document.title;
  const description = document
    .querySelector('meta[name="description"]')
    ?.getAttribute("content") ?? "";
  const containers = root.querySelectorAll("main,article,[role=main]");
  const primary = containers[0]?.textContent ?? document.body?.textContent ?? "";
  const headings = Array.from(root.querySelectorAll("h1,h2,h3,h4,h5,h6"))
    .map((element) => element.textContent ?? "")
    .join(" ");
  const links = Array.from(root.querySelectorAll("a"))
    .slice(0, 80)
    .map((element) => element.textContent ?? "")
    .join(" ");
  const alt = Array.from(root.querySelectorAll("img[alt]"))
    .slice(0, 80)
    .map((element) => element.getAttribute("alt") ?? "")
    .join(" ");

  return {
    text: [description, primary, headings, links].join(" ").slice(0, 16000),
    title,
    alt,
  };
}

function scan(root: ParentNode): void {
  if (!enabled || siteAllowed || blocked) return;

  if (siteBlocked) {
    console.info("[Zengen] Classification result", {
      url: location.href,
      score: 100,
      blocked: true,
      signals: "SITE_BLOCKED",
    });

    blockPage(100);
    blocked = true;
    return;
  }

  const result = classify({
    ...getPageSnapshot(root),
    url: location.href,
  });

  console.info("[Zengen] Classification result", {
    url: location.href,
    score: result.score,
    blocked: result.blocked,
    signals: result.signals.join(", "),
  });

  if (result.blocked) {
    blockPage(result.score);
    blocked = true;
  }
}

function scheduleScan(root: ParentNode = document): void {
  if (!enabled || siteAllowed || scheduled || blocked) return;

  scheduled = true;

  queueMicrotask(() => {
    scheduled = false;

    requestAnimationFrame(() => {
      if (enabled && !siteAllowed && !blocked) {
        scan(root);
      }
    });
  });
}

function observe(): void {
  const observer = new MutationObserver((mutations) => {
    if (!enabled || siteAllowed || blocked) return;

    let shouldScan = false;

    for (const mutation of mutations) {
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        shouldScan = true;
        break;
      }

      if (
        mutation.type === "attributes" &&
        ["alt", "title", "src", "href"].includes(mutation.attributeName ?? "")
      ) {
        shouldScan = true;
        break;
      }
    }

    if (shouldScan) {
      scheduleScan();
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["alt", "title", "src", "href"],
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;

  if (changes.enabled || changes.allowlist || changes.blocklist) {
    void loadSettings().then(() => {
      if (!enabled || siteAllowed) {
        return;
      }

      blocked = false;
      scheduleScan();
    });
  }
});

async function init(): Promise<void> {
  await loadSettings();

  if (!enabled || siteAllowed) return;

  scheduleScan();
  observe();

  window.addEventListener("popstate", () => {
    if (!enabled || siteAllowed) return;

    blocked = false;
    scheduleScan();
  });

  window.addEventListener("hashchange", () => {
    if (!enabled || siteAllowed) return;

    blocked = false;
    scheduleScan();
  });
}

init();
