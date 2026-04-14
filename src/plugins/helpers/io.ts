import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import * as flaresolverr from "./flaresolverr";

const execFileAsync = promisify(execFile);

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export async function downloadFile(
  url: string,
  outputPath: string,
  options?: {
    userAgent?: string;
    cookies?: string;
    headers?: Record<string, string>;
    redirect?: RequestRedirect;
    /** When set, solves Cloudflare in-browser first, then downloads with returned cookies. */
    flaresolverrUrl?: string;
  }
): Promise<void> {
  const dir = path.dirname(outputPath);
  await fsp.mkdir(dir, { recursive: true });

  const fetchOptions: RequestInit = {};
  if (options?.redirect) {
    fetchOptions.redirect = options.redirect;
  }

  async function pipeDownload(headers: Record<string, string>): Promise<void> {
    const res = await fetch(url, { ...fetchOptions, headers });
    if (!res.ok || !res.body) {
      throw new Error(
        `Failed to download ${url}: ${res.status} ${res.statusText}`
      );
    }

    const nodeStream = Readable.fromWeb(res.body as never);
    const fileStream = fs.createWriteStream(outputPath);
    await pipeline(nodeStream, fileStream);
  }

  function buildHeaders(cookieHeader?: string, userAgent?: string): Record<string, string> {
    const headers: Record<string, string> = {
      "User-Agent": userAgent || options?.userAgent || DEFAULT_USER_AGENT,
    };
    if (cookieHeader) {
      headers["Cookie"] = cookieHeader;
    }
    if (options?.headers) {
      Object.assign(headers, options.headers);
    }
    return headers;
  }

  const fsUrl = options?.flaresolverrUrl?.trim();
  if (fsUrl && /^https?:\/\//i.test(url)) {
    try {
      const { cookies: fsCookies, userAgent: fsUa } =
        await flaresolverr.fetchCookiesForUrl(url, fsUrl, {
          maxTimeoutMs: 120_000,
        });
      const mergedCookies = [options?.cookies, fsCookies]
        .filter((c) => c && String(c).trim())
        .join("; ");
      const ua = options?.userAgent || fsUa || DEFAULT_USER_AGENT;
      try {
        await pipeDownload(buildHeaders(mergedCookies || undefined, ua));
        return;
      } catch {
        await pipeDownload(
          buildHeaders(options?.cookies || undefined, options?.userAgent)
        );
        return;
      }
    } catch {
      await pipeDownload(
        buildHeaders(options?.cookies || undefined, options?.userAgent)
      );
      return;
    }
  }

  await pipeDownload(
    buildHeaders(options?.cookies || undefined, options?.userAgent)
  );
}

export async function downloadFiles(
  files: Array<{ url: string; outputPath: string }>,
  concurrency: number = 5,
  options?: {
    userAgent?: string;
    cookies?: string;
    flaresolverrUrl?: string;
  }
): Promise<void> {
  const chunks: Array<typeof files> = [];
  for (let i = 0; i < files.length; i += concurrency) {
    chunks.push(files.slice(i, i + concurrency));
  }
  for (const chunk of chunks) {
    await Promise.all(
      chunk.map((file) =>
        downloadFile(file.url, file.outputPath, options)
      )
    );
  }
}

export async function ensureDir(dirPath: string): Promise<void> {
  await fsp.mkdir(dirPath, { recursive: true });
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function moveFile(src: string, dest: string): Promise<void> {
  const dir = path.dirname(dest);
  await fsp.mkdir(dir, { recursive: true });
  await fsp.rename(src, dest);
}

export async function createZip(
  sourceDir: string,
  outputPath: string
): Promise<void> {
  const absOutput = path.resolve(outputPath);
  const dir = path.dirname(absOutput);
  await fsp.mkdir(dir, { recursive: true });
  await execFileAsync("zip", ["-r", absOutput, "."], { cwd: sourceDir });
}

export async function listFiles(
  dirPath: string,
  pattern?: RegExp
): Promise<string[]> {
  const entries = await fsp.readdir(dirPath, { withFileTypes: true });
  let files = entries
    .filter((e) => e.isFile())
    .map((e) => path.join(dirPath, e.name));
  if (pattern) {
    files = files.filter((f) => pattern.test(path.basename(f)));
  }
  return files;
}
