import { classify } from "./classifier/classifier";
import { blockPage } from "./ui/blocker";

const processed = new WeakSet<Element>();
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

  siteAllowed = allowlist.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  );

  siteBlocked = blocklist.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  );

  if (!enabled || siteAllowed) {
    blocked = false;
  }
}

function getElementText(element: Element): string {
  const text = element.textContent ?? "";

  if (text.length > 12000) {
    return text.slice(0, 12000);
  }

  return text;
}

function isRelevant(element: Element): boolean {
  if (
    element instanceof HTMLScriptElement ||
    element instanceof HTMLStyleElement ||
    element instanceof HTMLMetaElement ||
    element instanceof HTMLLinkElement ||
    element instanceof SVGElement
  ) {
    return false;
  }

  return true;
}

function scoreElement(element: Element): number {
  const html = element as HTMLElement;

  const result = classify({
    text: getElementText(element),
    title: html.getAttribute("title") ?? "",
    alt: html.getAttribute("alt") ?? "",
    url: location.href,
  });

  return result.score;
}

function scan(root: ParentNode): void {
  if (!enabled || siteAllowed || blocked) return;

  if (siteBlocked) {
    blockPage(100);
    blocked = true;
    return;
  }

  const elements = root.querySelectorAll(
    "body,main,article,section,div,p,h1,h2,h3,h4,h5,h6,a,img",
  );

  let highestScore = 0;

  for (const element of elements) {
    if (processed.has(element)) continue;
    if (!isRelevant(element)) continue;

    processed.add(element);

    const score = scoreElement(element);

    if (score > highestScore) {
      highestScore = score;
    }

    if (score >= 90) {
      blockPage(score);
      blocked = true;
      return;
    }
  }

  if (highestScore >= 70) {
    blockPage(highestScore);
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
