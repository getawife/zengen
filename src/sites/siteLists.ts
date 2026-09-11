export type SiteLists = {
  allowlist: string[];
  blocklist: string[];
};

const defaults: SiteLists = {
  allowlist: [],
  blocklist: [],
};

export async function getSiteLists(): Promise<SiteLists> {
  const result = await chrome.storage.local.get(defaults);

  return {
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

export async function saveSiteLists(lists: SiteLists): Promise<void> {
  await chrome.storage.local.set({
    allowlist: [...new Set(lists.allowlist)].sort(),
    blocklist: [...new Set(lists.blocklist)].sort(),
  });
}

export async function addAllowedSite(domain: string): Promise<void> {
  const lists = await getSiteLists();

  lists.allowlist = [...new Set([...lists.allowlist, domain])];
  lists.blocklist = lists.blocklist.filter((site) => site !== domain);

  await saveSiteLists(lists);
}

export async function removeAllowedSite(domain: string): Promise<void> {
  const lists = await getSiteLists();

  lists.allowlist = lists.allowlist.filter((site) => site !== domain);

  await saveSiteLists(lists);
}

export async function addBlockedSite(domain: string): Promise<void> {
  const lists = await getSiteLists();

  lists.blocklist = [...new Set([...lists.blocklist, domain])];
  lists.allowlist = lists.allowlist.filter((site) => site !== domain);

  await saveSiteLists(lists);
}

export async function removeBlockedSite(domain: string): Promise<void> {
  const lists = await getSiteLists();

  lists.blocklist = lists.blocklist.filter((site) => site !== domain);

  await saveSiteLists(lists);
}
