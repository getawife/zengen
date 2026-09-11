const toggle = document.querySelector<HTMLButtonElement>("#toggle");
const statusElement = document.querySelector<HTMLElement>("#status");

async function load(): Promise<void> {
  const settings = await chrome.storage.local.get({
    enabled: true,
  });

  update(Boolean(settings.enabled));
}

function update(enabled: boolean): void {
  if (!toggle || !statusElement) return;

  toggle.textContent = enabled ? "Protection enabled" : "Protection disabled";

  toggle.dataset.enabled = String(enabled);
  statusElement.textContent = enabled ? "Active" : "Paused";
}

toggle?.addEventListener("click", async () => {
  const settings = await chrome.storage.local.get({
    enabled: true,
  });

  const enabled = !Boolean(settings.enabled);

  await chrome.storage.local.set({
    enabled,
  });

  update(enabled);
});

load();
