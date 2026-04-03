"use client";

import { useState, useEffect } from "react";
import { Plus, CalendarClock, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { CronPicker } from "./cron-picker";
import { validateCron } from "@/lib/cron";

interface ScheduleData {
  id: number;
  label: string;
  url: string;
  cronExpression: string;
}

interface ScheduleDialogProps {
  mode: "create" | "edit";
  schedule?: ScheduleData;
  onSaved: () => void;
  trigger?: React.ReactNode;
}

export function ScheduleDialog({
  mode,
  schedule,
  onSaved,
  trigger,
}: ScheduleDialogProps) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [cronExpression, setCronExpression] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && schedule && mode === "edit") {
      setLabel(schedule.label);
      setUrl(schedule.url);
      setCronExpression(schedule.cronExpression);
      setError(null);
    } else if (open && mode === "create") {
      setLabel("");
      setUrl("");
      setCronExpression("");
      setError(null);
    }
  }, [open, schedule, mode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !url.trim() || !cronExpression.trim()) return;

    const validation = validateCron(cronExpression);
    if (!validation.valid) {
      setError(`Invalid schedule: ${validation.error}`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const endpoint =
        mode === "edit" && schedule
          ? `/api/schedules/${schedule.id}`
          : "/api/schedules";

      const res = await fetch(endpoint, {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim(),
          url: url.trim(),
          cronExpression: cronExpression.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save schedule");
      }

      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            size="sm"
            className="gap-1.5 font-heading text-xs uppercase tracking-wider"
          >
            <Plus className="size-3.5" />
            Add Schedule
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading text-base uppercase tracking-wider">
            {mode === "edit" ? (
              <Pencil className="size-4 text-primary" />
            ) : (
              <CalendarClock className="size-4 text-primary" />
            )}
            {mode === "edit" ? "Edit Schedule" : "New Schedule"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {mode === "edit"
              ? "Update the schedule configuration."
              : "Set up a URL to be automatically archived on a recurring schedule."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label className="text-xs font-heading uppercase tracking-wider">
              Label
            </Label>
            <Input
              placeholder="Reddit daily backup"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              className="text-sm"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-xs font-heading uppercase tracking-wider">
              URL
            </Label>
            <Input
              placeholder="https://example.com/content"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              type="url"
              required
              className="font-mono text-sm"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-xs font-heading uppercase tracking-wider">
              Schedule
            </Label>
            <CronPicker value={cronExpression} onChange={setCronExpression} />
          </div>
          {error && (
            <p className="text-xs text-destructive font-medium">{error}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading}
              className="font-heading text-xs uppercase tracking-wider"
            >
              {loading
                ? "Saving..."
                : mode === "edit"
                  ? "Save"
                  : "Create Schedule"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
