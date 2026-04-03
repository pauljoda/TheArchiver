import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { execFile } from "child_process";
import { promisify } from "util";

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
  }
): Promise<void> {
  const dir = path.dirname(outputPath);
  await fsp.mkdir(dir, { recursive: true });

  const headers: Record<string, string> = {
    "User-Agent": options?.userAgent || DEFAULT_USER_AGENT,
  };
  if (options?.cookies) {
    headers["Cookie"] = options.cookies;
  }
  if (options?.headers) {
    Object.assign(headers, options.headers);
  }

  const fetchOptions: RequestInit = { headers };
  if (options?.redirect) {
    fetchOptions.redirect = options.redirect;
  }

  const res = await fetch(url, fetchOptions);
  if (!res.ok || !res.body) {
    throw new Error(
      `Failed to download ${url}: ${res.status} ${res.statusText}`
    );
  }

  const nodeStream = Readable.fromWeb(res.body as never);
  const fileStream = fs.createWriteStream(outputPath);
  await pipeline(nodeStream, fileStream);
}

export async function downloadFiles(
  files: Array<{ url: string; outputPath: string }>,
  concurrency: number = 5,
  options?: { userAgent?: string; cookies?: string }
): Promise<void> {
  const chunks: Array<typeof files> = [];
  for (let i = 0; i < files.length; i += concurrency) {
    chunks.push(files.slice(i, i + concurrency));
  }
  for (const chunk of chunks) {
    await Promise.all(
      chunk.map((file) => downloadFile(file.url, file.outputPath, options))
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
