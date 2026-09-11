import { createIcons, ArrowLeft, Plus, Trash2 } from "lucide";

type SiteLists = {
  allowlist: string[];
  blocklist: string[];
};

type Settings = SiteLists & {
  pinConfigured: boolean;
};

const allowForm = document.querySelector<HTMLFormElement>("#allow-form");
const blockForm = document.querySelector<HTMLFormElement>("#block-form");
const allowInput = document.querySelector<HTMLInputElement>("#allow-input");
const blockInput = document.querySelector<HTMLInputElement>("#block-input");
const allowList = document.querySelector<HTMLElement>("#allow-list");
const blockList = document.querySelector<HTMLElement>("#block-list");
const errorElement = document.querySelector<HTMLElement>("#error");
const pinForm = document.querySelector<HTMLFormElement>("#pin-form");
const currentPinInput =
  document.querySelector<HTMLInputElement>("#current-pin");
const newPinInput = document.querySelector<HTMLInputElement>("#new-pin");
const confirmPinInput =
  document.querySelector<HTMLInputElement>("#confirm-pin");

async function getLists(): Promise<SiteLists> {
  const result = (await chrome.runtime.sendMessage({
    type: "get-settings",
  })) as Partial<Settings> | undefined;

  return {
    allowlist: Array.isArray(result?.allowlist) ? result.allowlist : [],
    blocklist: Array.isArray(result?.blocklist) ? result.blocklist : [],
  };
}

async function getSettings(): Promise<Settings> {
  const result = (await chrome.runtime.sendMessage({
    type: "get-settings",
  })) as Partial<Settings> | undefined;

  return {
    allowlist: Array.isArray(result?.allowlist) ? result.allowlist : [],
    blocklist: Array.isArray(result?.blocklist) ? result.blocklist : [],
    pinConfigured: Boolean(result?.pinConfigured),
  };
}

async function requestPin(): Promise<string | undefined> {
  const settings = await getSettings();

  if (!settings.pinConfigured) return undefined;

  const pin = window.prompt("Enter your parental-controls PIN.");

  return pin === null ? undefined : pin;
}

async function saveLists(
  lists: SiteLists,
  pin: string | undefined,
): Promise<void> {
  const response = await chrome.runtime.sendMessage({
    type: "update-lists",
    allowlist: lists.allowlist,
    blocklist: lists.blocklist,
    pin,
  });

  if (!response?.ok) {
    throw new Error(response?.error ?? "Unable to update site rules.");
  }
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

function showError(message: string): void {
  if (errorElement) {
    errorElement.textContent = message;
  }
}

function clearError(): void {
  if (errorElement) {
    errorElement.textContent = "";
  }
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
      try {
        const pin = await requestPin();
        const lists = await getLists();

        if (type === "allow") {
          lists.allowlist = lists.allowlist.filter((item) => item !== site);
        } else {
          lists.blocklist = lists.blocklist.filter((item) => item !== site);
        }

        await saveLists(lists, pin);
        clearError();
        await render();
      } catch (error) {
        showError(
          error instanceof Error
            ? error.message
            : "Unable to update site rules.",
        );
      }
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
    const pin = await requestPin();
    const lists = await getLists();

    if (type === "allow") {
      lists.allowlist = [...new Set([...lists.allowlist, domain])];

      lists.blocklist = lists.blocklist.filter((site) => site !== domain);
    } else {
      lists.blocklist = [...new Set([...lists.blocklist, domain])];

      lists.allowlist = lists.allowlist.filter((site) => site !== domain);
    }

    await saveLists(lists, pin);

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

pinForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const currentPin = currentPinInput?.value || undefined;
  const newPin = newPinInput?.value ?? "";
  const confirmPin = confirmPinInput?.value ?? "";

  if (newPin !== confirmPin) {
    showError("PINs do not match.");
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: "set-pin",
      currentPin,
      newPin,
    });

    if (!response?.ok) {
      throw new Error(response?.error ?? "Unable to save PIN.");
    }

    if (currentPinInput) currentPinInput.value = "";
    if (newPinInput) newPinInput.value = "";
    if (confirmPinInput) confirmPinInput.value = "";
    clearError();
  } catch (error) {
    showError(error instanceof Error ? error.message : "Unable to save PIN.");
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.allowlist || changes.blocklist)) {
    void render();
  }
});

void render();
