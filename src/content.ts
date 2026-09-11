import { classify } from "./classifier/classifier";
import { blockPage } from "./ui/blocker";

const processed = new WeakSet<Element>();

let scheduled = false;
let blocked = false;

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
  if (blocked) return;

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
  if (scheduled || blocked) return;

  scheduled = true;

  queueMicrotask(() => {
    scheduled = false;

    requestAnimationFrame(() => {
      scan(root);
    });
  });
}

function observe(): void {
  const observer = new MutationObserver((mutations) => {
    if (blocked) return;

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

function init(): void {
  scheduleScan();
  observe();

  window.addEventListener("popstate", () => {
    blocked = false;
    scheduleScan();
  });

  window.addEventListener("hashchange", () => {
    blocked = false;
    scheduleScan();
  });
}

init();
