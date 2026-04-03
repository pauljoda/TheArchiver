import { Cron } from "croner";

export const PRESET_CRONS = [
  { label: "Every 6h", cron: "0 */6 * * *" },
  { label: "Every 12h", cron: "0 */12 * * *" },
  { label: "Daily", cron: "0 0 * * *" },
  { label: "Weekly", cron: "0 0 * * 0" },
] as const;

export function getNextRunDate(cronExpression: string): Date | null {
  try {
    return new Cron(cronExpression).nextRun() ?? null;
  } catch {
    return null;
  }
}

export function validateCron(
  cronExpression: string
): { valid: true } | { valid: false; error: string } {
  try {
    new Cron(cronExpression);
    return { valid: true };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : "Invalid cron expression",
    };
  }
}
