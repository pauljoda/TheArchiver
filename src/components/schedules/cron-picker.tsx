"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PRESET_CRONS, validateCron, getNextRunDate } from "@/lib/cron";
import { cn } from "@/lib/utils";

interface CronPickerProps {
  value: string;
  onChange: (cron: string) => void;
}

export function CronPicker({ value, onChange }: CronPickerProps) {
  const [advanced, setAdvanced] = useState(
    () => !PRESET_CRONS.some((p) => p.cron === value) && value !== ""
  );

  const selectedPreset = PRESET_CRONS.find((p) => p.cron === value);
  const validation = value ? validateCron(value) : null;
  const nextRun = validation?.valid ? getNextRunDate(value) : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {PRESET_CRONS.map((preset) => (
          <Button
            key={preset.cron}
            type="button"
            variant={selectedPreset?.cron === preset.cron && !advanced ? "default" : "outline"}
            size="sm"
            className="text-xs font-heading uppercase tracking-wider"
            onClick={() => {
              onChange(preset.cron);
              setAdvanced(false);
            }}
          >
            {preset.label}
          </Button>
        ))}
        <Button
          type="button"
          variant={advanced ? "default" : "outline"}
          size="sm"
          className="text-xs font-heading uppercase tracking-wider gap-1"
          onClick={() => setAdvanced(!advanced)}
        >
          Custom
          <ChevronDown
            className={cn(
              "size-3 transition-transform",
              advanced && "rotate-180"
            )}
          />
        </Button>
      </div>

      {advanced && (
        <Input
          placeholder="0 */6 * * *"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-sm"
        />
      )}

      {value && validation && !validation.valid && (
        <p className="text-xs text-destructive">
          {validation.error}
        </p>
      )}

      {nextRun && (
        <p className="text-xs text-muted-foreground">
          Next run: {nextRun.toLocaleString()}
        </p>
      )}
    </div>
  );
}
