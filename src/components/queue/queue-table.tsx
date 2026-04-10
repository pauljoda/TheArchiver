"use client";

import { Trash2, Loader2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AddUrlDialog } from "./add-url-dialog";
import { cn } from "@/lib/utils";

interface QueueItem {
  id: number;
  url: string;
  status: string;
  pluginName: string | null;
  createdAt: string | number;
}

interface QueueTableProps {
  items: QueueItem[];
  onRefresh: () => void;
}

export function QueueTable({ items, onRefresh }: QueueTableProps) {
  async function handleDelete(id: number) {
    await fetch(`/api/queue/${id}`, { method: "DELETE" });
    onRefresh();
  }

  async function handleClearAll() {
    await fetch("/api/queue/clear", { method: "DELETE" });
    onRefresh();
  }

  return (
    <Card className="overflow-hidden border-border/50">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-card">
        <div className="flex items-center gap-3">
          <CardTitle className="font-heading text-sm uppercase tracking-wider">
            Download Queue
          </CardTitle>
          {items.length > 0 && (
            <Badge variant="secondary" className="font-mono text-[10px]">
              {items.length} item{items.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <AddUrlDialog onAdded={onRefresh} />
          {items.length > 0 && (
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleClearAll}>
              Clear All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Link2 className="size-5 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">
                Queue is empty
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Add a URL to start archiving
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {items.map((item, i) => (
              <div
                key={item.id}
                className={cn(
                  "group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/30 animate-vault-enter"
                )}
                style={{ animationDelay: `${i * 30}ms` }}
              >
                {/* Status indicator */}
                <div
                  className={cn(
                    "status-dot shrink-0",
                    item.status === "processing"
                      ? "status-dot-active"
                      : "bg-muted-foreground/30"
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
                        item.status === "processing" ? "default" : "secondary"
                      }
                      className={cn(
                        "text-[10px] uppercase tracking-wider font-heading",
                        item.status === "processing" && "animate-pulse-amber"
                      )}
                    >
                      {item.status === "processing" && (
                        <Loader2 className="size-2.5 animate-spin mr-1" />
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

                {/* Actions — always visible on touch devices; fade-on-hover only on pointer:fine */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 opacity-100 [@media(pointer:fine)]:opacity-0 [@media(pointer:fine)]:group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleDelete(item.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
