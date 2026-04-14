import * as cheerio from "cheerio";
import * as flaresolverr from "./flaresolverr";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export async function fetchPage(
  url: string,
  options?: {
    userAgent?: string;
    cookies?: string;
    flaresolverrUrl?: string;
  }
): Promise<string> {
  const fsUrl = options?.flaresolverrUrl?.trim();
  if (fsUrl) {
    try {
      return await flaresolverr.fetchPage(url, fsUrl);
    } catch {
      // FlareSolverr misconfigured, down, or target error — fall back to direct fetch
    }
  }

  const headers: Record<string, string> = {
    "User-Agent": options?.userAgent || DEFAULT_USER_AGENT,
  };
  if (options?.cookies) {
    headers["Cookie"] = options.cookies;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

export function parse(html: string): cheerio.CheerioAPI {
  return cheerio.load(html);
}

export function select(html: string, selector: string): string[] {
  const $ = cheerio.load(html);
  return $(selector)
    .map((_, el) => $(el).text())
    .get();
}

export function selectAttr(
  html: string,
  selector: string,
  attr: string
): string[] {
  const $ = cheerio.load(html);
  return $(selector)
    .map((_, el) => $(el).attr(attr) || "")
    .get()
    .filter(Boolean);
}

export function selectHtml(html: string, selector: string): string[] {
  const $ = cheerio.load(html);
  return $(selector)
    .map((_, el) => $(el).html() || "")
    .get()
    .filter(Boolean);
}
