"use client";

import { CheckCircle2, XCircle, Archive, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface HistoryItem {
  id: number;
  url: string;
  status: string;
  pluginName: string | null;
  errorMessage: string | null;
  completedAt: string | number;
}

interface RecentActivityProps {
  items: HistoryItem[];
  onRefresh: () => void;
}

export function RecentActivity({ items, onRefresh }: RecentActivityProps) {
  async function handleDelete(id: number) {
    await fetch(`/api/history/${id}`, { method: "DELETE" });
    onRefresh();
  }

  async function handleClearAll() {
    await fetch("/api/history/clear", { method: "DELETE" });
    onRefresh();
  }

  return (
    <Card className="overflow-hidden border-border/50">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-card">
        <div className="flex items-center gap-3">
          <CardTitle className="font-heading text-sm uppercase tracking-wider">
            Archive History
          </CardTitle>
          {items.length > 0 && (
            <Badge variant="secondary" className="font-mono text-[10px]">
              {items.length} total
            </Badge>
          )}
        </div>
        {items.length > 0 && (
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleClearAll}>
            Clear All
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Archive className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              No archive history yet
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {items.slice(0, 25).map((item, i) => (
              <div
                key={item.id}
                className={cn(
                  "group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/30 animate-vault-enter"
                )}
                style={{ animationDelay: `${i * 20}ms` }}
              >
                {/* Status indicator */}
                <div
                  className={cn(
                    "status-dot shrink-0",
                    item.status === "completed"
                      ? "status-dot-success"
                      : "status-dot-error"
                  )}
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="text-sm font-mono truncate text-foreground/90">
                        {item.url}
                      </p>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-sm">
                      <p className="font-mono text-xs break-all">{item.url}</p>
                    </TooltipContent>
                  </Tooltip>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge
                      variant={
                        item.status === "completed" ? "secondary" : "destructive"
                      }
                      className={cn(
                        "text-[10px] uppercase tracking-wider font-heading",
                        item.status === "completed" &&
                          "bg-success/10 text-success"
                      )}
                    >
                      {item.status === "completed" ? (
                        <CheckCircle2 className="size-2.5 mr-1" />
                      ) : (
                        <XCircle className="size-2.5 mr-1" />
                      )}
                      {item.status}
                    </Badge>
                    {item.pluginName && (
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {item.pluginName}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Timestamp & Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <span className="hidden sm:block text-[10px] font-mono text-muted-foreground/50">
                    {item.completedAt
                      ? new Date(item.completedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : ""}
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-100 [@media(pointer:fine)]:opacity-0 [@media(pointer:fine)]:group-hover:opacity-100 transition-opacity"
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
