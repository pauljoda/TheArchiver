import { getSetting } from "@/lib/settings";
import * as flaresolverr from "./flaresolverr";

interface RateLimiterOptions {
  /** Minimum milliseconds between requests. */
  minIntervalMs: number;
  /** HTTP status codes that trigger a retry (e.g. [429]). Default: [429]. */
  retryOnStatus?: number[];
  /** Milliseconds to wait before retrying on a retryable status. Default: 30000. */
  retryDelayMs?: number;
  /** Maximum number of retries per request. Default: 1. */
  maxRetries?: number;
}

interface RateLimitedFetchOptions extends RequestInit {
  /** Logger to report rate limit waits and retries. */
  logger?: { info: (msg: string) => void; warn: (msg: string) => void };
}

/**
 * For GET requests without a body, optionally bootstraps clearance cookies via
 * FlareSolverr (core setting) before calling the origin directly.
 */
async function fetchWithFlareSolverrPreference(
  url: string,
  init?: RateLimitedFetchOptions
): Promise<Response> {
  const { logger: _logger, ...rest } = init ?? {};
  const method = (rest.method ?? "GET").toUpperCase();
  const base = getSetting<string>("core.flaresolverr_url")?.trim();

  if (
    !base ||
    !/^https?:\/\//i.test(url) ||
    method !== "GET" ||
    rest.body != null
  ) {
    return fetch(url, rest);
  }

  try {
    const { cookies, userAgent } = await flaresolverr.fetchCookiesForUrl(
      url,
      base,
      { maxTimeoutMs: 120_000 }
    );
    const headers = new Headers(rest.headers);
    if (userAgent && !headers.has("user-agent")) {
      headers.set("User-Agent", userAgent);
    }
    if (cookies) {
      const existing = headers.get("Cookie");
      headers.set(
        "Cookie",
        existing ? `${existing}; ${cookies}` : cookies
      );
    }
    return fetch(url, { ...rest, headers });
  } catch {
    return fetch(url, rest);
  }
}

/**
 * Create a rate-limited fetch wrapper. Ensures minimum time between requests
 * and retries on configurable status codes (e.g. 429 Too Many Requests).
 *
 * @example
 * ```ts
 * const fetchReddit = createRateLimiter({
 *   minIntervalMs: 6500,
 *   retryOnStatus: [429],
 *   retryDelayMs: 60000,
 * });
 *
 * const res = await fetchReddit(url, { logger });
 * const data = await res.json();
 * ```
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const {
    minIntervalMs,
    retryOnStatus = [429],
    retryDelayMs = 30000,
    maxRetries = 1,
  } = options;

  let lastRequestTime = 0;

  async function rateLimitedFetch(
    url: string,
    fetchOptions?: RateLimitedFetchOptions
  ): Promise<Response> {
    const logger = fetchOptions?.logger;

    // Enforce minimum interval
    const elapsed = Date.now() - lastRequestTime;
    if (elapsed < minIntervalMs) {
      const waitMs = minIntervalMs - elapsed;
      if (logger) logger.info(`Rate limiting: waiting ${waitMs}ms`);
      await sleep(waitMs);
    }

    let attempt = 0;
    while (true) {
      lastRequestTime = Date.now();

      // Strip logger from fetch options
      const { logger: _, ...nativeFetchOptions } = fetchOptions ?? {};
      const res = await fetchWithFlareSolverrPreference(
        url,
        nativeFetchOptions
      );

      if (retryOnStatus.includes(res.status) && attempt < maxRetries) {
        attempt++;
        if (logger) {
          logger.warn(
            `Got ${res.status}, retrying in ${retryDelayMs}ms (attempt ${attempt}/${maxRetries})`
          );
        }
        await sleep(retryDelayMs);
        continue;
      }

      return res;
    }
  }

  return rateLimitedFetch;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
