const toggle = document.querySelector<HTMLButtonElement>("#toggle");
const statusElement = document.querySelector<HTMLElement>("#status");

async function getSettings(): Promise<{ enabled: boolean }> {
  return chrome.runtime.sendMessage({
    type: "get-settings",
  });
}

function update(enabled: boolean): void {
  if (!toggle || !statusElement) return;

  toggle.textContent = enabled ? "Disable protection" : "Enable protection";

  statusElement.textContent = enabled
    ? "Protection active"
    : "Protection paused";
}

async function load(): Promise<void> {
  const settings = await getSettings();

  update(settings.enabled);
}

toggle?.addEventListener("click", async () => {
  const settings = await getSettings();
  const enabled = !settings.enabled;

  const response = await chrome.runtime.sendMessage({
    type: "set-enabled",
    enabled,
  });

  if (response?.ok) {
    update(enabled);
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.enabled) return;

  update(Boolean(changes.enabled.newValue));
});

load();
