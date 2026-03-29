/**
 * In-memory ring buffer for server console logs.
 * Uses globalThis so the buffer is shared across all Next.js webpack bundles.
 * Works in both development and production (standalone Docker).
 */

export interface LogEntry {
  timestamp: string;
  source: string;
  level: "LOG" | "WARN" | "ERROR" | "INFO";
  message: string;
}

interface LogBufferGlobal {
  __logBuffer?: LogEntry[];
  __logBufferInstalled?: boolean;
}

const MAX_ENTRIES = 1000;

const g = globalThis as unknown as LogBufferGlobal;
if (!g.__logBuffer) g.__logBuffer = [];

function getBuffer(): LogEntry[] {
  return g.__logBuffer!;
}

function formatTimestamp(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

function push(level: LogEntry["level"], args: unknown[]): void {
  const message = args
    .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
    .join(" ");

  const buf = getBuffer();
  buf.push({ timestamp: formatTimestamp(), source: "Server", level, message });

  // Trim to max size
  if (buf.length > MAX_ENTRIES) {
    buf.splice(0, buf.length - MAX_ENTRIES);
  }
}

/**
 * Intercepts console.log/warn/error to capture output into the ring buffer.
 * Original console methods are preserved and still called (output still goes to stdout/stderr).
 * Safe to call multiple times — only installs once.
 */
export function installConsoleCapture(): void {
  if (g.__logBufferInstalled) return;
  g.__logBufferInstalled = true;

  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;

  console.log = (...args: unknown[]) => {
    push("LOG", args);
    origLog.apply(console, args);
  };

  console.warn = (...args: unknown[]) => {
    push("WARN", args);
    origWarn.apply(console, args);
  };

  console.error = (...args: unknown[]) => {
    push("ERROR", args);
    origError.apply(console, args);
  };
}

/** Returns the last `n` log entries (default: all, max 500). */
export function getLogEntries(n = 500): LogEntry[] {
  const buf = getBuffer();
  return buf.slice(-n);
}
