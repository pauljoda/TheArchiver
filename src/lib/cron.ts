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

/**
 * Structured schedule model that the UI edits directly. The cron expression
 * is derived from this config via {@link buildCron} and only exists as a
 * backend storage format — users never type one by hand.
 */
export type ScheduleMode = "hourly" | "daily" | "weekly" | "monthly";

export interface ScheduleConfig {
  mode: ScheduleMode;
  /** Hours between runs in hourly mode (1-23). */
  interval: number;
  /** Minute of the hour (0-59). */
  minute: number;
  /** Hour of the day (0-23). */
  hour: number;
  /** Days of the week (0=Sunday..6=Saturday) for weekly mode. */
  weekdays: number[];
  /** Day of the month (1-31) for monthly mode. */
  monthDay: number;
}

export const DEFAULT_SCHEDULE_CONFIG: ScheduleConfig = {
  mode: "daily",
  interval: 6,
  minute: 0,
  hour: 9,
  weekdays: [1],
  monthDay: 1,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Build a cron expression from a structured schedule config. */
export function buildCron(config: ScheduleConfig): string {
  const minute = clamp(config.minute, 0, 59);
  const hour = clamp(config.hour, 0, 23);

  switch (config.mode) {
    case "hourly": {
      const n = clamp(config.interval, 1, 23);
      return `${minute} */${n} * * *`;
    }
    case "daily":
      return `${minute} ${hour} * * *`;
    case "weekly": {
      const days =
        config.weekdays.length > 0
          ? [...new Set(config.weekdays)].sort((a, b) => a - b).join(",")
          : "1";
      return `${minute} ${hour} * * ${days}`;
    }
    case "monthly": {
      const day = clamp(config.monthDay, 1, 31);
      return `${minute} ${hour} ${day} * *`;
    }
  }
}

/**
 * Attempt to reverse a cron expression back into a ScheduleConfig so the
 * builder UI can pre-fill when editing an existing schedule. Only recognises
 * the shapes produced by {@link buildCron}; returns null for anything else.
 */
export function parseCron(cron: string | null | undefined): ScheduleConfig | null {
  if (!cron) return null;
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [minuteField, hourField, domField, monField, dowField] = parts;
  if (monField !== "*") return null;

  const minute = Number(minuteField);
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null;

  // Hourly: M */N * * *
  const hourlyMatch = /^\*\/(\d+)$/.exec(hourField);
  if (hourlyMatch && domField === "*" && dowField === "*") {
    const interval = Number(hourlyMatch[1]);
    if (!Number.isInteger(interval) || interval < 1 || interval > 23) return null;
    return { ...DEFAULT_SCHEDULE_CONFIG, mode: "hourly", interval, minute };
  }

  const hour = Number(hourField);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;

  // Daily: M H * * *
  if (domField === "*" && dowField === "*") {
    return { ...DEFAULT_SCHEDULE_CONFIG, mode: "daily", minute, hour };
  }

  // Weekly: M H * * D(,D)*
  if (domField === "*" && dowField !== "*") {
    const days = dowField.split(",").map((d) => Number(d));
    if (
      days.length > 0 &&
      days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    ) {
      return {
        ...DEFAULT_SCHEDULE_CONFIG,
        mode: "weekly",
        minute,
        hour,
        weekdays: [...new Set(days)].sort((a, b) => a - b),
      };
    }
    return null;
  }

  // Monthly: M H D * *
  if (dowField === "*" && domField !== "*") {
    const day = Number(domField);
    if (Number.isInteger(day) && day >= 1 && day <= 31) {
      return {
        ...DEFAULT_SCHEDULE_CONFIG,
        mode: "monthly",
        minute,
        hour,
        monthDay: day,
      };
    }
  }

  return null;
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function formatClock(hour: number, minute: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const suffix = hour < 12 ? "AM" : "PM";
  return `${h12}:${minute.toString().padStart(2, "0")} ${suffix}`;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** Human-readable description of a structured schedule config. */
export function describeSchedule(config: ScheduleConfig): string {
  switch (config.mode) {
    case "hourly": {
      const base =
        config.interval === 1 ? "Every hour" : `Every ${config.interval} hours`;
      return config.minute > 0
        ? `${base} at :${config.minute.toString().padStart(2, "0")}`
        : base;
    }
    case "daily":
      return `Every day at ${formatClock(config.hour, config.minute)}`;
    case "weekly": {
      const days = [...new Set(config.weekdays)].sort((a, b) => a - b);
      if (days.length === 0) return "Weekly (no days selected)";
      if (days.length === 7) {
        return `Every day at ${formatClock(config.hour, config.minute)}`;
      }
      const names = days.map((d) => WEEKDAY_SHORT[d] ?? "?").join(", ");
      return `Every ${names} at ${formatClock(config.hour, config.minute)}`;
    }
    case "monthly":
      return `On the ${ordinal(config.monthDay)} of each month at ${formatClock(
        config.hour,
        config.minute
      )}`;
  }
}

/**
 * Human-readable description of a raw cron expression. Falls back to the
 * expression itself for shapes that {@link parseCron} doesn't recognise.
 */
export function describeCron(cron: string): string {
  const parsed = parseCron(cron);
  if (parsed) return describeSchedule(parsed);
  return cron;
}
