export function extractBaseUrl(urlString: string): string {
  try {
    const url = new URL(urlString);
    return url.origin;
  } catch {
    return urlString;
  }
}

export function extractHostname(urlString: string): string {
  try {
    const url = new URL(urlString);
    return url.hostname;
  } catch {
    return urlString;
  }
}

export function joinUrl(base: string, ...paths: string[]): string {
  let result = base.replace(/\/+$/, "");
  for (const p of paths) {
    result += "/" + p.replace(/^\/+/, "");
  }
  return result;
}
