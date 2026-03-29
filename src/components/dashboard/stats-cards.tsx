"use client";

import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  Puzzle,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardsProps {
  queueCount: number;
  failedCount: number;
  historyCount: number;
  pluginCount: number;
}

const stats = [
  {
    key: "queued",
    label: "Queued",
    sub: "Pending downloads",
    icon: Clock,
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/20",
    glowClass: "group-hover:shadow-[0_0_20px_var(--amber-glow)]",
  },
  {
    key: "failed",
    label: "Failed",
    sub: "Need attention",
    icon: AlertTriangle,
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    borderColor: "border-destructive/20",
    glowClass:
      "group-hover:shadow-[0_0_20px_oklch(0.65_0.22_25/15%)]",
  },
  {
    key: "completed",
    label: "Archived",
    sub: "Total downloads",
    icon: CheckCircle2,
    color: "text-emerald-500 dark:text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
    glowClass:
      "group-hover:shadow-[0_0_20px_oklch(0.7_0.17_145/15%)]",
  },
  {
    key: "plugins",
    label: "Plugins",
    sub: "Active handlers",
    icon: Puzzle,
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    borderColor: "border-border",
    glowClass: "group-hover:shadow-[0_0_20px_oklch(0.5_0.02_260/10%)]",
  },
] as const;

export function StatsCards({
  queueCount,
  failedCount,
  historyCount,
  pluginCount,
}: StatsCardsProps) {
  const counts: Record<string, number> = {
    queued: queueCount,
    failed: failedCount,
    completed: historyCount,
    plugins: pluginCount,
  };

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        const count = counts[stat.key];
        return (
          <div
            key={stat.key}
            className={cn(
              "group relative overflow-hidden rounded-xl border bg-card p-4 transition-all duration-300 hover:-translate-y-0.5",
              stat.borderColor,
              stat.glowClass,
              "animate-vault-enter"
            )}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            {/* Subtle noise overlay */}
            <div className="noise-bg absolute inset-0 opacity-50" />

            <div className="relative z-10 flex items-start justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-heading font-medium uppercase tracking-widest text-muted-foreground">
                  {stat.label}
                </span>
                <span className="text-3xl font-heading font-bold tracking-tight tabular-nums">
                  {count}
                </span>
                <span className="text-[11px] text-muted-foreground/70">
                  {stat.sub}
                </span>
              </div>
              <div
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg transition-colors",
                  stat.bgColor
                )}
              >
                <Icon className={cn("size-4", stat.color)} />
              </div>
            </div>

            {/* Bottom accent line */}
            {count > 0 && (
              <div
                className={cn(
                  "absolute bottom-0 left-0 h-0.5 transition-all duration-500",
                  stat.key === "failed"
                    ? "bg-destructive"
                    : stat.key === "completed"
                    ? "bg-emerald-500"
                    : "bg-primary"
                )}
                style={{ width: `${Math.min(100, count * 10)}%` }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
