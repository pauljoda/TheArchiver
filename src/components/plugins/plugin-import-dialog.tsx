"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, Package, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { SettingsForm } from "@/components/settings/settings-form";

interface PluginImportDialogProps {
  onImported: () => void;
}

interface SettingData {
  key: string;
  type: "string" | "number" | "boolean" | "password" | "select";
  label: string;
  description?: string;
  value: string | number | boolean | null;
  defaultValue?: string | number | boolean;
  validation?: {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
    options?: Array<{ label: string; value: string }>;
  };
}

export function PluginImportDialog({ onImported }: PluginImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingSettings, setPendingSettings] = useState<SettingData[] | null>(
    null
  );
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setError(null);
    setSuccess(null);
    setPendingSettings(null);
    setLoading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function processFile(file: File) {
    if (!file.name.endsWith(".zip")) {
      setError("Only .zip files are accepted");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    setPendingSettings(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/plugins/install", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to install plugin");
      }

      const verb = data.updated ? "updated" : "installed";
      if (data.requiresConfiguration && data.settings?.length) {
        setSuccess(
          `Plugin "${data.plugin.name}" ${verb}. Please configure required settings:`
        );
        setPendingSettings(
          data.settings.map((s: SettingData) => ({
            ...s,
            value: s.defaultValue ?? null,
          }))
        );
      } else {
        setSuccess(`Plugin "${data.plugin.name}" ${verb} successfully.`);
        onImported();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  async function handleSettingsSave(
    updates: Array<{ key: string; value: unknown }>
  ) {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: updates }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to save settings");
    }
    setPendingSettings(null);
    setSuccess("Plugin configured successfully.");
    onImported();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="gap-1.5 font-heading text-xs uppercase tracking-wider"
        >
          <Upload className="size-3.5" />
          Import
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading text-base uppercase tracking-wider">
            <Package className="size-4 text-primary" />
            Import Plugin
          </DialogTitle>
          <DialogDescription className="text-xs">
            Upload a plugin .zip file containing manifest.json and index.js.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {!pendingSettings && (
            <label
              onDragOver={handleDragOver}
              onDragEnter={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`group flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-10 transition-all ${
                dragging
                  ? "border-primary bg-primary/10 scale-[1.02]"
                  : "border-border/60 bg-muted/20 hover:border-primary/40 hover:bg-primary/5"
              }`}
            >
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 transition-colors group-hover:bg-primary/20">
                <Upload className="size-5 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">
                  Drop a .zip file or click to browse
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Plugin archives only
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".zip"
                onChange={handleUpload}
                className="sr-only"
                disabled={loading}
              />
            </label>
          )}

          {loading && (
            <div className="flex items-center justify-center gap-2 py-2">
              <div className="size-1.5 rounded-full bg-primary animate-pulse-amber" />
              <p className="text-xs text-muted-foreground font-mono">
                Installing plugin...
              </p>
            </div>
          )}

          {error && (
            <p className="text-xs text-destructive font-medium">{error}</p>
          )}

          {success && !pendingSettings && (
            <div className="flex flex-col gap-3 animate-vault-fade">
              <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                <Check className="size-4" />
                {success}
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={() => setOpen(false)}
                  size="sm"
                  className="font-heading text-xs uppercase tracking-wider"
                >
                  Done
                </Button>
              </div>
            </div>
          )}

          {pendingSettings && (
            <div className="flex flex-col gap-3 animate-vault-fade">
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                {success}
              </p>
              <SettingsForm
                title="Plugin Settings"
                settings={pendingSettings}
                onSave={handleSettingsSave}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
