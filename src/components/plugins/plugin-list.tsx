"use client";

import { useState } from "react";
import Link from "next/link";
import { Puzzle, Settings, Trash2, Power, User } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PluginImportDialog } from "./plugin-import-dialog";
import { cn } from "@/lib/utils";

interface PluginInfo {
  id: string;
  name: string;
  version?: string;
  description?: string;
  author?: string;
  urlPatterns: string[];
  enabled: boolean;
  hasSettings: boolean;
}

interface PluginListProps {
  plugins: PluginInfo[];
  onRefresh?: () => void;
}

export function PluginList({ plugins, onRefresh }: PluginListProps) {
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  async function handleToggle(id: string, enabled: boolean) {
    setTogglingId(id);
    try {
      await fetch(`/api/plugins/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      onRefresh?.();
    } catch (err) {
      console.error("Failed to toggle plugin:", err);
    } finally {
      setTogglingId(null);
    }
  }

  async function handleRemove(id: string) {
    setRemovingId(id);
    try {
      await fetch(`/api/plugins/${id}`, { method: "DELETE" });
      setConfirmRemove(null);
      onRefresh?.();
    } catch (err) {
      console.error("Failed to remove plugin:", err);
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <Card className="overflow-hidden border-border/50">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-card">
        <div className="flex items-center gap-3">
          <CardTitle className="font-heading text-sm uppercase tracking-wider">
            Plugins
          </CardTitle>
          <Badge variant="secondary" className="font-mono text-[10px]">
            {plugins.length} installed
          </Badge>
        </div>
        <PluginImportDialog onImported={() => onRefresh?.()} />
      </CardHeader>
      <CardContent className="p-0">
        {plugins.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Puzzle className="size-5 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">
                No plugins installed
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Import a plugin .zip to get started
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {plugins.map((plugin, i) => (
              <div
                key={plugin.id}
                className={cn(
                  "group flex items-start gap-4 px-5 py-4 transition-colors hover:bg-muted/30 animate-vault-enter",
                  !plugin.enabled && "opacity-50"
                )}
                style={{ animationDelay: `${i * 40}ms` }}
              >
                {/* Plugin icon */}
                <div
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                    plugin.enabled
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <Puzzle className="size-4" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{plugin.name}</span>
                    {plugin.version && (
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono"
                      >
                        v{plugin.version}
                      </Badge>
                    )}
                    {!plugin.enabled && (
                      <Badge variant="secondary" className="text-[10px] font-heading uppercase tracking-wider">
                        <Power className="size-2.5 mr-0.5" />
                        Off
                      </Badge>
                    )}
                  </div>
                  {plugin.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {plugin.description}
                    </p>
                  )}
                  {plugin.author && (
                    <p className="flex items-center gap-1 text-[11px] text-muted-foreground/60 mt-0.5">
                      <User className="size-2.5" />
                      {plugin.author}
                    </p>
                  )}
                  {plugin.urlPatterns.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {plugin.urlPatterns.map((pattern) => (
                        <Badge
                          key={pattern}
                          variant="secondary"
                          className="text-[10px] font-mono"
                        >
                          {pattern}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Switch
                    checked={plugin.enabled}
                    disabled={togglingId === plugin.id}
                    onCheckedChange={(checked) =>
                      handleToggle(plugin.id, checked)
                    }
                  />
                  {plugin.hasSettings && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-foreground"
                          asChild
                        >
                          <Link href={`/settings?group=plugin:${plugin.name}`}>
                            <Settings className="size-3.5" />
                          </Link>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Settings</TooltipContent>
                    </Tooltip>
                  )}
                  {confirmRemove === plugin.id ? (
                    <div className="flex items-center gap-1 animate-slide-in">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-7 text-[10px] font-heading uppercase tracking-wider"
                        disabled={removingId === plugin.id}
                        onClick={() => handleRemove(plugin.id)}
                      >
                        {removingId === plugin.id ? "..." : "Confirm"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[10px]"
                        onClick={() => setConfirmRemove(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setConfirmRemove(plugin.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Remove</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
