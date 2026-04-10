"use client";

import { Trash2, RotateCcw, AlertCircle } from "lucide-react";
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

interface FailedItem {
  id: number;
  url: string;
  errorMessage: string | null;
  pluginName: string | null;
  completedAt: string | number;
}

interface FailedTableProps {
  items: FailedItem[];
  onRefresh: () => void;
}

export function FailedTable({ items, onRefresh }: FailedTableProps) {
  async function handleRetry(id: number) {
    await fetch(`/api/failed/${id}/retry`, { method: "POST" });
    onRefresh();
  }

  async function handleDelete(id: number) {
    await fetch(`/api/failed/${id}`, { method: "DELETE" });
    onRefresh();
  }

  async function handleClearAll() {
    await fetch("/api/failed/clear", { method: "DELETE" });
    onRefresh();
  }

  return (
    <Card className="overflow-hidden border-border/50">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-card">
        <div className="flex items-center gap-3">
          <CardTitle className="font-heading text-sm uppercase tracking-wider">
            Failed Downloads
          </CardTitle>
          {items.length > 0 && (
            <Badge variant="destructive" className="font-mono text-[10px]">
              {items.length}
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
            <div className="flex size-12 items-center justify-center rounded-full bg-success/10">
              <AlertCircle className="size-5 text-success" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              No failed downloads
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {items.map((item, i) => (
              <div
                key={item.id}
                className={cn(
                  "group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-destructive/[0.03] animate-vault-enter"
                )}
                style={{ animationDelay: `${i * 30}ms` }}
              >
                {/* Error indicator */}
                <div className="status-dot status-dot-error shrink-0" />

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
                  {item.errorMessage && (
                    <p className="text-[11px] text-destructive/80 mt-0.5 truncate font-mono">
                      {item.errorMessage}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge
                      variant="destructive"
                      className="text-[10px] uppercase tracking-wider font-heading"
                    >
                      failed
                    </Badge>
                    {item.pluginName && (
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {item.pluginName}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Actions — always visible on touch devices; fade-on-hover only on pointer:fine */}
                <div className="flex gap-1 shrink-0 opacity-100 [@media(pointer:fine)]:opacity-0 [@media(pointer:fine)]:group-hover:opacity-100 transition-opacity">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                        onClick={() => handleRetry(item.id)}
                      >
                        <RotateCcw className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Retry</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
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
