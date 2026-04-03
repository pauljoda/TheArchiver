import { exec } from "child_process";

export interface ExecAsyncOptions {
  maxBuffer?: number;
  timeout?: number;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
}

/**
 * Wraps child_process.exec in a Promise with enriched error handling.
 * On failure, the thrown error includes stdout and stderr properties
 * for partial-output inspection (e.g., detecting partial downloads).
 */
export function execAsync(
  cmd: string,
  options?: ExecAsyncOptions
): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    exec(
      cmd,
      {
        maxBuffer: options?.maxBuffer ?? 10 * 1024 * 1024,
        timeout: options?.timeout,
      },
      (error, stdout, stderr) => {
        if (error) {
          const enriched = Object.assign(error, {
            stdout: stdout?.toString() ?? "",
            stderr: stderr?.toString() ?? "",
          });
          reject(enriched);
        } else {
          resolve({
            stdout: stdout?.toString() ?? "",
            stderr: stderr?.toString() ?? "",
          });
        }
      }
    );
  });
}
