export function normalizeDomain(input: string): string {
  let value = input.trim().toLowerCase();

  if (!value) {
    throw new Error("Domain is required");
  }

  if (!value.includes("://")) {
    value = `https://${value}`;
  }

  let hostname: string;

  try {
    hostname = new URL(value).hostname.toLowerCase();
  } catch {
    throw new Error("Invalid domain");
  }

  hostname = hostname.replace(/\.$/, "");

  if (hostname.startsWith("www.")) {
    hostname = hostname.slice(4);
  }

  if (
    hostname === "localhost" ||
    hostname.includes("/") ||
    hostname.includes("..") ||
    !hostname.includes(".")
  ) {
    throw new Error("Invalid domain");
  }

  if (!/^[a-z0-9.-]+$/i.test(hostname)) {
    throw new Error("Invalid domain");
  }

  return hostname;
}

export function domainMatches(hostname: string, domain: string): boolean {
  const normalizedHostname = hostname.toLowerCase().replace(/\.$/, "");
  const normalizedDomain = domain.toLowerCase().replace(/\.$/, "");

  return (
    normalizedHostname === normalizedDomain ||
    normalizedHostname.endsWith(`.${normalizedDomain}`)
  );
}
