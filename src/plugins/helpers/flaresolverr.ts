/**
 * Client for FlareSolverr (https://github.com/FlareSolverr/FlareSolverr).
 * POST JSON to /v1 with cmd "request.get" etc.
 */

export interface FlareSolverrPageWithCookies {
  html: string;
  /** Cookie header value suitable for follow-up requests (e.g. downloadFile). */
  cookies: string;
  /** User-Agent from the solved session, if provided. */
  userAgent: string | null;
}

interface FlareSolverrCookie {
  name?: string;
  value?: string;
}

interface FlareSolverrV1Response {
  status?: string;
  message?: string;
  /** Present on health-style responses (e.g. sessions.list). */
  version?: string;
  solution?: {
    status?: number;
    response?: string;
    headers?: Record<string, string>;
    cookies?: FlareSolverrCookie[];
    userAgent?: string;
  };
}

export interface FlareSolverrTestResult {
  success: boolean;
  message: string;
  version?: string;
  latencyMs?: number;
}

function normalizeBaseUrl(flaresolverrUrl: string): string {
  return flaresolverrUrl.trim().replace(/\/+$/, "");
}

function cookiesToHeader(cookies: FlareSolverrCookie[] | undefined): string {
  if (!cookies?.length) return "";
  return cookies
    .filter((c) => c.name != null && c.value != null)
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

async function postV1(
  flaresolverrUrl: string,
  body: Record<string, unknown>
): Promise<FlareSolverrV1Response> {
  const base = normalizeBaseUrl(flaresolverrUrl);
  const res = await fetch(`${base}/v1`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let parsed: FlareSolverrV1Response;
  try {
    parsed = JSON.parse(text) as FlareSolverrV1Response;
  } catch {
    throw new Error(
      `FlareSolverr returned non-JSON (${res.status}): ${text.slice(0, 200)}`
    );
  }

  if (parsed.status !== "ok" || !parsed.solution) {
    const msg = parsed.message ?? "unknown error";
    throw new Error(`FlareSolverr error: ${msg}`);
  }

  return parsed;
}

/**
 * Fetch page HTML through FlareSolverr (solves Cloudflare challenges).
 */
export async function fetchPage(
  url: string,
  flaresolverrUrl: string,
  options?: { maxTimeoutMs?: number }
): Promise<string> {
  const { html } = await fetchPageWithCookies(url, flaresolverrUrl, options);
  return html;
}

/**
 * Same as fetchPage but returns cookies and user-agent for follow-up direct downloads.
 */
export async function fetchPageWithCookies(
  url: string,
  flaresolverrUrl: string,
  options?: { maxTimeoutMs?: number; returnOnlyCookies?: boolean }
): Promise<FlareSolverrPageWithCookies> {
  const maxTimeout = options?.maxTimeoutMs ?? 60_000;
  const parsed = await postV1(flaresolverrUrl, {
    cmd: "request.get",
    url,
    maxTimeout,
    ...(options?.returnOnlyCookies ? { returnOnlyCookies: true } : {}),
  });

  const sol = parsed.solution!;
  const html = sol.response ?? "";
  if (sol.status != null && (sol.status < 200 || sol.status >= 300)) {
    throw new Error(
      `FlareSolverr target returned HTTP ${sol.status} for ${url}`
    );
  }

  return {
    html,
    cookies: cookiesToHeader(sol.cookies),
    userAgent: sol.userAgent ?? null,
  };
}

/**
 * Opens the URL in FlareSolverr (solves challenges) and returns clearance cookies
 * for follow-up direct HTTP downloads on the same host.
 */
export async function fetchCookiesForUrl(
  url: string,
  flaresolverrUrl: string,
  options?: { maxTimeoutMs?: number }
): Promise<{ cookies: string; userAgent: string | null }> {
  const { cookies, userAgent } = await fetchPageWithCookies(
    url,
    flaresolverrUrl,
    { ...options, returnOnlyCookies: true }
  );
  return { cookies, userAgent };
}

/**
 * Returns true if the FlareSolverr instance responds to a lightweight API call.
 */
export async function isAvailable(
  flaresolverrUrl: string,
  options?: { timeoutMs?: number }
): Promise<boolean> {
  const r = await testConnection(flaresolverrUrl, options);
  return r.success;
}

/**
 * Lightweight check that FlareSolverr is reachable and speaking the v1 API.
 */
export async function testConnection(
  flaresolverrUrl: string,
  options?: { timeoutMs?: number }
): Promise<FlareSolverrTestResult> {
  const timeoutMs = options?.timeoutMs ?? 15_000;
  const t0 = Date.now();
  try {
    const base = normalizeBaseUrl(flaresolverrUrl);
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${base}/v1`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cmd: "sessions.list" }),
        signal: controller.signal,
      });
      const text = await res.text();
      const latencyMs = Date.now() - t0;
      let data: FlareSolverrV1Response;
      try {
        data = JSON.parse(text) as FlareSolverrV1Response;
      } catch {
        return {
          success: false,
          message: `Expected JSON from FlareSolverr (${res.status}). Body starts with: ${text.slice(0, 120)}`,
        };
      }
      if (data.status !== "ok") {
        return {
          success: false,
          message: data.message || "FlareSolverr returned a non-ok status",
          latencyMs,
        };
      }
      return {
        success: true,
        message: `Connected in ${latencyMs} ms`,
        version: typeof data.version === "string" ? data.version : undefined,
        latencyMs,
      };
    } finally {
      clearTimeout(t);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      message:
        msg === "This operation was aborted"
          ? `Timed out after ${timeoutMs} ms`
          : `Unreachable: ${msg}`,
    };
  }
}
