"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Globe,
  Download,
  Check,
  RefreshCw,
  ArrowUpCircle,
  Puzzle,
  User,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CommunityPlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  downloadFile: string;
  installed: boolean;
  installedVersion: string | null;
  updateAvailable: boolean;
}

interface CommunityBrowserProps {
  onInstalled: () => void;
}

export function CommunityBrowser({ onInstalled }: CommunityBrowserProps) {
  const [open, setOpen] = useState(false);
  const [plugins, setPlugins] = useState<CommunityPlugin[]>([]);
  const [baseUrl, setBaseUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [installResult, setInstallResult] = useState<Record<string, "success" | "error">>({});

  const fetchPlugins = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/plugins/community");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch community plugins");
      }
      const data = await res.json();
      setPlugins(data.plugins);
      setBaseUrl(data.baseUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchPlugins();
      setInstallResult({});
    }
  }, [open, fetchPlugins]);

  async function handleInstall(plugin: CommunityPlugin) {
    setInstallingId(plugin.id);
    setInstallResult((prev) => {
      const next = { ...prev };
      delete next[plugin.id];
      return next;
    });

    try {
      const downloadUrl = `${baseUrl}/${plugin.downloadFile}`;
      const res = await fetch("/api/plugins/community/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ downloadUrl }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to install plugin");
      }

      setInstallResult((prev) => ({ ...prev, [plugin.id]: "success" }));
      // Refresh the list to update installed status
      await fetchPlugins();
      onInstalled();
    } catch (err) {
      console.error("Failed to install community plugin:", err);
      setInstallResult((prev) => ({ ...prev, [plugin.id]: "error" }));
    } finally {
      setInstallingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 font-heading text-xs uppercase tracking-wider"
        >
          <Globe className="size-3.5" />
          Browse
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading text-base uppercase tracking-wider">
            <Globe className="size-4 text-primary" />
            Community Plugins
          </DialogTitle>
          <DialogDescription className="text-xs">
            Browse and install plugins from the community repository.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {loading && plugins.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-12">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground font-mono">
                Fetching plugins...
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <AlertCircle className="size-5 text-destructive" />
              <p className="text-xs text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchPlugins}
                className="gap-1.5 text-xs"
              >
                <RefreshCw className="size-3" />
                Retry
              </Button>
            </div>
          ) : plugins.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Puzzle className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                No community plugins available
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {plugins.map((plugin, i) => (
                <div
                  key={plugin.id}
                  className="flex items-start gap-3 py-4 animate-vault-enter"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  {/* Plugin icon */}
                  <div
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg",
                      plugin.installed
                        ? "bg-emerald-500/10 text-emerald-500"
                        : "bg-primary/10 text-primary"
                    )}
                  >
                    <Puzzle className="size-4" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{plugin.name}</span>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        v{plugin.version}
                      </Badge>
                      {plugin.installed && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-heading uppercase tracking-wider text-emerald-600 dark:text-emerald-400"
                        >
                          <Check className="size-2.5 mr-0.5" />
                          Installed
                        </Badge>
                      )}
                      {plugin.updateAvailable && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-heading uppercase tracking-wider text-amber-600 dark:text-amber-400"
                        >
                          <ArrowUpCircle className="size-2.5 mr-0.5" />
                          Update
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
                    {installResult[plugin.id] === "error" && (
                      <p className="text-xs text-destructive mt-1">
                        Installation failed. Please try again.
                      </p>
                    )}
                  </div>

                  {/* Action */}
                  <div className="shrink-0">
                    {plugin.installed && !plugin.updateAvailable ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled
                        className="gap-1.5 text-xs text-emerald-600 dark:text-emerald-400"
                      >
                        <Check className="size-3" />
                        Installed
                      </Button>
                    ) : (
                      <Button
                        variant={plugin.updateAvailable ? "outline" : "default"}
                        size="sm"
                        disabled={installingId !== null}
                        onClick={() => handleInstall(plugin)}
                        className="gap-1.5 font-heading text-xs uppercase tracking-wider"
                      >
                        {installingId === plugin.id ? (
                          <>
                            <Loader2 className="size-3 animate-spin" />
                            Installing...
                          </>
                        ) : plugin.updateAvailable ? (
                          <>
                            <ArrowUpCircle className="size-3" />
                            Update
                          </>
                        ) : (
                          <>
                            <Download className="size-3" />
                            Install
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
