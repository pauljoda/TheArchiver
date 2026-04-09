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
  solution?: {
    status?: number;
    response?: string;
    headers?: Record<string, string>;
    cookies?: FlareSolverrCookie[];
    userAgent?: string;
  };
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
  options?: { maxTimeoutMs?: number }
): Promise<FlareSolverrPageWithCookies> {
  const maxTimeout = options?.maxTimeoutMs ?? 60_000;
  const parsed = await postV1(flaresolverrUrl, {
    cmd: "request.get",
    url,
    maxTimeout,
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
 * Returns true if the FlareSolverr instance responds to a lightweight API call.
 */
export async function isAvailable(
  flaresolverrUrl: string,
  options?: { timeoutMs?: number }
): Promise<boolean> {
  const timeoutMs = options?.timeoutMs ?? 5000;
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
      if (!res.ok) return false;
      const data = (await res.json()) as FlareSolverrV1Response;
      return data.status === "ok";
    } finally {
      clearTimeout(t);
    }
  } catch {
    return false;
  }
}
