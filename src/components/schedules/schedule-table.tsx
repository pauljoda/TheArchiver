"use client";

import { useState } from "react";
import {
  CalendarClock,
  Play,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScheduleDialog } from "./schedule-dialog";
import { describeCron } from "@/lib/cron";
import { cn } from "@/lib/utils";

interface ScheduleItem {
  id: number;
  label: string;
  url: string;
  cronExpression: string;
  enabled: boolean;
  lastRunAt: string | number | null;
  nextRunAt: string | number | null;
  createdAt: string | number;
}

interface ScheduleTableProps {
  items: ScheduleItem[];
  onRefresh: () => void;
}

function formatRelativeTime(dateValue: string | number | null): string {
  if (!dateValue) return "Never";
  const date = new Date(
    typeof dateValue === "number" ? dateValue * 1000 : dateValue
  );
  if (isNaN(date.getTime())) return "Never";
  const now = Date.now();
  const diffMs = date.getTime() - now;
  const absDiff = Math.abs(diffMs);

  if (absDiff < 60_000) return diffMs > 0 ? "< 1m" : "just now";

  const minutes = Math.floor(absDiff / 60_000);
  if (minutes < 60) return diffMs > 0 ? `${minutes}m` : `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return diffMs > 0 ? `${hours}h` : `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return diffMs > 0 ? `${days}d` : `${days}d ago`;
}


export function ScheduleTable({ items, onRefresh }: ScheduleTableProps) {
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [runningId, setRunningId] = useState<number | null>(null);

  async function handleToggle(id: number, enabled: boolean) {
    setTogglingId(id);
    try {
      await fetch(`/api/schedules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      onRefresh();
    } catch (err) {
      console.error("Failed to toggle schedule:", err);
    } finally {
      setTogglingId(null);
    }
  }

  async function handleRunNow(id: number) {
    setRunningId(id);
    try {
      await fetch(`/api/schedules/${id}/run-now`, { method: "POST" });
      onRefresh();
    } catch (err) {
      console.error("Failed to run schedule:", err);
    } finally {
      setRunningId(null);
    }
  }

  async function handleDelete(id: number) {
    try {
      await fetch(`/api/schedules/${id}`, { method: "DELETE" });
      onRefresh();
    } catch (err) {
      console.error("Failed to delete schedule:", err);
    }
  }

  return (
    <Card className="overflow-hidden border-border/50">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-card">
        <div className="flex items-center gap-3">
          <CardTitle className="font-heading text-sm uppercase tracking-wider">
            Schedules
          </CardTitle>
          {items.length > 0 && (
            <Badge variant="secondary" className="font-mono text-[10px]">
              {items.length} configured
            </Badge>
          )}
        </div>
        <ScheduleDialog mode="create" onSaved={onRefresh} />
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <CalendarClock className="size-5 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">
                No schedules configured
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Create a schedule to automatically archive URLs
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {items.map((item, i) => (
              <div
                key={item.id}
                className={cn(
                  "group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/30 animate-vault-enter",
                  !item.enabled && "opacity-50"
                )}
                style={{ animationDelay: `${i * 30}ms` }}
              >
                {/* Status dot */}
                <div
                  className={cn(
                    "status-dot shrink-0",
                    item.enabled
                      ? "status-dot-active"
                      : "bg-muted-foreground/30"
                  )}
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {item.label}
                  </p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="text-xs font-mono truncate text-muted-foreground mt-0.5">
                        {item.url}
                      </p>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-sm">
                      <p className="font-mono text-xs break-all">{item.url}</p>
                    </TooltipContent>
                  </Tooltip>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge
                      variant="outline"
                      className="text-[10px] font-normal"
                    >
                      {describeCron(item.cronExpression)}
                    </Badge>
                    {item.lastRunAt && (
                      <span className="text-[10px] text-muted-foreground/60">
                        Last: {formatRelativeTime(item.lastRunAt)}
                      </span>
                    )}
                    {item.enabled && item.nextRunAt && (
                      <span className="text-[10px] text-primary/80">
                        Next: {formatRelativeTime(item.nextRunAt)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Switch
                    checked={item.enabled}
                    disabled={togglingId === item.id}
                    onCheckedChange={(checked) =>
                      handleToggle(item.id, checked)
                    }
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 opacity-100 [@media(pointer:fine)]:opacity-0 [@media(pointer:fine)]:group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary hover:bg-primary/10"
                        disabled={runningId === item.id}
                        onClick={() => handleRunNow(item.id)}
                      >
                        <Play
                          className={cn(
                            "size-3.5",
                            runningId === item.id && "animate-pulse"
                          )}
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Run Now</TooltipContent>
                  </Tooltip>
                  <ScheduleDialog
                    mode="edit"
                    schedule={item}
                    onSaved={onRefresh}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 opacity-100 [@media(pointer:fine)]:opacity-0 [@media(pointer:fine)]:group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                        title="Edit"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    }
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 opacity-100 [@media(pointer:fine)]:opacity-0 [@media(pointer:fine)]:group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
