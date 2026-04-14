"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildCron,
  DEFAULT_SCHEDULE_CONFIG,
  describeSchedule,
  getNextRunDate,
  parseCron,
  type ScheduleConfig,
  type ScheduleMode,
} from "@/lib/cron";
import { cn } from "@/lib/utils";

interface CronPickerProps {
  value: string;
  onChange: (cron: string) => void;
}

const MODE_OPTIONS: { value: ScheduleMode; label: string }[] = [
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const HOUR_INTERVALS = [1, 2, 3, 4, 6, 8, 12];

const WEEKDAYS = [
  { value: 0, short: "S", label: "Sun" },
  { value: 1, short: "M", label: "Mon" },
  { value: 2, short: "T", label: "Tue" },
  { value: 3, short: "W", label: "Wed" },
  { value: 4, short: "T", label: "Thu" },
  { value: 5, short: "F", label: "Fri" },
  { value: 6, short: "S", label: "Sat" },
] as const;

function hourLabel(hour: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const suffix = hour < 12 ? "AM" : "PM";
  return `${h12} ${suffix}`;
}

export function CronPicker({ value, onChange }: CronPickerProps) {
  const [config, setConfig] = useState<ScheduleConfig>(
    () => parseCron(value) ?? DEFAULT_SCHEDULE_CONFIG
  );
  // Tracks whether the current cron expression this component represents is
  // one the user can see accurately in the builder. When false, the parent
  // holds an exotic cron string that parseCron can't round-trip; we show a
  // warning and only emit a replacement once the user actively edits the form.
  const [unrepresentable, setUnrepresentable] = useState<string | null>(() =>
    value && !parseCron(value) ? value : null
  );
  // True once the user has interacted with any builder control in the current
  // session. Prevents silently emitting a replacement cron when editing an
  // existing schedule whose expression we can't parse.
  const [dirty, setDirty] = useState(false);

  // Re-sync from parent when a different existing schedule is loaded (e.g.
  // when the edit dialog opens with a new `value`). We intentionally skip
  // re-syncing on cron strings this component itself just produced so the
  // user's in-progress edits aren't clobbered.
  const lastEmittedRef = useRef<string | null>(null);
  useEffect(() => {
    if (value === lastEmittedRef.current) return;
    const parsed = parseCron(value);
    if (parsed) {
      setConfig(parsed);
      setUnrepresentable(null);
      setDirty(false);
    } else if (!value) {
      setConfig(DEFAULT_SCHEDULE_CONFIG);
      setUnrepresentable(null);
      setDirty(false);
    } else {
      // Non-empty but unparseable — keep the parent's value as-is until the
      // user explicitly edits the form.
      setUnrepresentable(value);
      setDirty(false);
    }
  }, [value]);

  // Push derived cron expression up to the parent whenever the config changes.
  useEffect(() => {
    if (unrepresentable && !dirty) return;
    const cron = buildCron(config);
    lastEmittedRef.current = cron;
    if (cron !== value) {
      onChange(cron);
    }
    // We only want to emit when config changes. `value`/`onChange` shouldn't
    // retrigger this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, dirty, unrepresentable]);

  const updateConfig = useCallback((patch: Partial<ScheduleConfig>) => {
    setDirty(true);
    setUnrepresentable(null);
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const toggleWeekday = useCallback((day: number) => {
    setDirty(true);
    setUnrepresentable(null);
    setConfig((prev) => {
      const set = new Set(prev.weekdays);
      if (set.has(day)) {
        if (set.size === 1) return prev; // require at least one day
        set.delete(day);
      } else {
        set.add(day);
      }
      return { ...prev, weekdays: [...set].sort((a, b) => a - b) };
    });
  }, []);

  const description = useMemo(() => describeSchedule(config), [config]);
  const cronExpression = useMemo(() => buildCron(config), [config]);
  const nextRun = useMemo(
    () => getNextRunDate(unrepresentable && !dirty ? unrepresentable : cronExpression),
    [cronExpression, unrepresentable, dirty]
  );
  const showBuilderSummary = !unrepresentable || dirty;

  return (
    <div className="flex flex-col gap-3">
      {unrepresentable && (
        <div className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2">
          <AlertTriangle className="size-3.5 shrink-0 text-yellow-600 dark:text-yellow-400 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground">
              Existing schedule uses a custom format
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5 font-mono break-all">
              {unrepresentable}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Picking any option below will replace it.
            </p>
          </div>
        </div>
      )}

      {/* Mode selector */}
      <div className="flex flex-wrap gap-1.5">
        {MODE_OPTIONS.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant={config.mode === option.value ? "default" : "outline"}
            size="sm"
            className="text-xs font-heading uppercase tracking-wider"
            onClick={() => updateConfig({ mode: option.value })}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {/* Mode-specific controls */}
      <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
        {config.mode === "hourly" && (
          <div className="flex flex-col gap-2">
            <Label>Every</Label>
            <div className="flex flex-wrap gap-1.5">
              {HOUR_INTERVALS.map((n) => (
                <Button
                  key={n}
                  type="button"
                  variant={config.interval === n ? "default" : "outline"}
                  size="sm"
                  className="text-xs font-mono min-w-10"
                  onClick={() => updateConfig({ interval: n })}
                >
                  {n}h
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Label>At minute</Label>
              <MinuteSelect
                value={config.minute}
                onChange={(minute) => updateConfig({ minute })}
              />
            </div>
          </div>
        )}

        {config.mode === "daily" && (
          <div className="flex items-center gap-2">
            <Label>At</Label>
            <TimePicker
              hour={config.hour}
              minute={config.minute}
              onHourChange={(hour) => updateConfig({ hour })}
              onMinuteChange={(minute) => updateConfig({ minute })}
            />
          </div>
        )}

        {config.mode === "weekly" && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label>On</Label>
              <div className="flex gap-1">
                {WEEKDAYS.map((day) => {
                  const selected = config.weekdays.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      title={day.label}
                      aria-pressed={selected}
                      onClick={() => toggleWeekday(day.value)}
                      className={cn(
                        "flex-1 h-8 rounded-md border text-xs font-heading uppercase tracking-wider transition-colors",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-transparent hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      {day.short}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label>At</Label>
              <TimePicker
                hour={config.hour}
                minute={config.minute}
                onHourChange={(hour) => updateConfig({ hour })}
                onMinuteChange={(minute) => updateConfig({ minute })}
              />
            </div>
          </div>
        )}

        {config.mode === "monthly" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Label>On day</Label>
              <Select
                value={String(config.monthDay)}
                onValueChange={(v) => updateConfig({ monthDay: Number(v) })}
              >
                <SelectTrigger size="sm" className="w-20 font-mono text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={String(d)} className="font-mono">
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">
                of each month
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Label>At</Label>
              <TimePicker
                hour={config.hour}
                minute={config.minute}
                onHourChange={(hour) => updateConfig({ hour })}
                onMinuteChange={(minute) => updateConfig({ minute })}
              />
            </div>
          </div>
        )}
      </div>

      {/* Summary */}
      {showBuilderSummary && (
        <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
          <Clock className="size-3.5 shrink-0 text-primary mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground">{description}</p>
            {nextRun && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Next run: {nextRun.toLocaleString()}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground">
      {children}
    </span>
  );
}

function TimePicker({
  hour,
  minute,
  onHourChange,
  onMinuteChange,
}: {
  hour: number;
  minute: number;
  onHourChange: (hour: number) => void;
  onMinuteChange: (minute: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Select
        value={String(hour)}
        onValueChange={(v) => onHourChange(Number(v))}
      >
        <SelectTrigger size="sm" className="w-24 font-mono text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: 24 }, (_, i) => i).map((h) => (
            <SelectItem key={h} value={String(h)} className="font-mono">
              {hourLabel(h)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-muted-foreground text-sm">:</span>
      <MinuteSelect value={minute} onChange={onMinuteChange} />
    </div>
  );
}

function MinuteSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (minute: number) => void;
}) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger size="sm" className="w-20 font-mono text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
          <SelectItem key={m} value={String(m)} className="font-mono">
            :{m.toString().padStart(2, "0")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
