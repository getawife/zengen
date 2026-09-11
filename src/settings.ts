import { createIcons, ArrowLeft, Plus, Trash2 } from "lucide";

type SiteLists = {
  allowlist: string[];
  blocklist: string[];
};

const allowForm = document.querySelector<HTMLFormElement>("#allow-form");

const blockForm = document.querySelector<HTMLFormElement>("#block-form");

const allowInput = document.querySelector<HTMLInputElement>("#allow-input");

const blockInput = document.querySelector<HTMLInputElement>("#block-input");

const allowList = document.querySelector<HTMLElement>("#allow-list");

const blockList = document.querySelector<HTMLElement>("#block-list");

const errorElement = document.querySelector<HTMLElement>("#error");

async function getLists(): Promise<SiteLists> {
  const result = await chrome.storage.local.get({
    allowlist: [],
    blocklist: [],
  });

  return {
    allowlist: Array.isArray(result.allowlist) ? result.allowlist : [],
    blocklist: Array.isArray(result.blocklist) ? result.blocklist : [],
  };
}

function normalizeDomain(input: string): string {
  let value = input.trim().toLowerCase();

  if (!value) {
    throw new Error("Enter a domain.");
  }

  if (!value.includes("://")) {
    value = `https://${value}`;
  }

  let hostname: string;

  try {
    hostname = new URL(value).hostname.toLowerCase();
  } catch {
    throw new Error("Enter a valid domain.");
  }

  hostname = hostname.replace(/\.$/, "");

  if (hostname.startsWith("www.")) {
    hostname = hostname.slice(4);
  }

  if (
    hostname === "localhost" ||
    hostname.includes("..") ||
    !hostname.includes(".")
  ) {
    throw new Error("Enter a valid domain.");
  }

  if (!/^[a-z0-9.-]+$/i.test(hostname)) {
    throw new Error("Enter a valid domain.");
  }

  return hostname;
}

async function saveLists(lists: SiteLists): Promise<void> {
  await chrome.storage.local.set({
    allowlist: [...new Set(lists.allowlist)].sort(),
    blocklist: [...new Set(lists.blocklist)].sort(),
  });
}

function showError(message: string): void {
  if (!errorElement) return;

  errorElement.textContent = message;
}

function clearError(): void {
  if (!errorElement) return;

  errorElement.textContent = "";
}

function renderList(
  container: HTMLElement | null,
  sites: string[],
  type: "allow" | "block",
): void {
  if (!container) return;

  container.innerHTML = "";

  if (sites.length === 0) {
    const empty = document.createElement("div");

    empty.className = "empty";
    empty.textContent =
      type === "allow" ? "No allowed sites" : "No blocked sites";

    container.appendChild(empty);
    return;
  }

  for (const site of sites) {
    const row = document.createElement("div");

    row.className = "site";

    const name = document.createElement("span");

    name.textContent = site;

    const remove = document.createElement("button");

    remove.type = "button";
    remove.className = "remove";
    remove.setAttribute("aria-label", `Remove ${site}`);

    const icon = document.createElement("i");

    icon.setAttribute("data-lucide", "trash-2");

    remove.appendChild(icon);

    remove.addEventListener("click", async () => {
      const lists = await getLists();

      if (type === "allow") {
        lists.allowlist = lists.allowlist.filter((item) => item !== site);
      } else {
        lists.blocklist = lists.blocklist.filter((item) => item !== site);
      }

      await saveLists(lists);
      await render();
    });

    row.append(name, remove);
    container.appendChild(row);
  }
}

async function render(): Promise<void> {
  const lists = await getLists();

  renderList(allowList, lists.allowlist, "allow");
  renderList(blockList, lists.blocklist, "block");

  createIcons({
    icons: {
      ArrowLeft,
      Plus,
      Trash2,
    },
  });
}

async function addSite(
  input: HTMLInputElement | null,
  type: "allow" | "block",
): Promise<void> {
  if (!input) return;

  try {
    const domain = normalizeDomain(input.value);
    const lists = await getLists();

    if (type === "allow") {
      lists.allowlist = [...new Set([...lists.allowlist, domain])];

      lists.blocklist = lists.blocklist.filter((site) => site !== domain);
    } else {
      lists.blocklist = [...new Set([...lists.blocklist, domain])];

      lists.allowlist = lists.allowlist.filter((site) => site !== domain);
    }

    await saveLists(lists);

    input.value = "";
    clearError();

    await render();
  } catch (error) {
    showError(error instanceof Error ? error.message : "Unable to add site.");
  }
}

allowForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  await addSite(allowInput, "allow");
});

blockForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  await addSite(blockInput, "block");
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.allowlist || changes.blocklist)) {
    void render();
  }
});

void render();
