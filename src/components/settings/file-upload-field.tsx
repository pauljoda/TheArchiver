"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, CheckCircle2, AlertCircle, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FileUploadFieldProps {
  settingKey: string;
  pluginId: string;
  label: string;
  description?: string;
  value: string | null;
  validation?: {
    accept?: string;
    maxSize?: number;
  };
  onChange: (key: string, value: string) => void;
}

type UploadState = "idle" | "uploading" | "success" | "error";

export function FileUploadField({
  settingKey,
  pluginId,
  label,
  description,
  value,
  validation,
  onChange,
}: FileUploadFieldProps) {
  const [state, setState] = useState<UploadState>(
    value && value !== "null" && value !== "" ? "success" : "idle"
  );
  const [filename, setFilename] = useState<string | null>(() => {
    if (value && value !== "null" && value !== "") {
      const parts = value.split("/");
      return parts[parts.length - 1];
    }
    return null;
  });
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasFile = state === "success" && filename;

  const handleUpload = useCallback(
    async (file: File) => {
      setError(null);
      setState("uploading");

      // Client-side size check
      if (validation?.maxSize && file.size > validation.maxSize) {
        const maxMB = (validation.maxSize / (1024 * 1024)).toFixed(1);
        setError(`File too large. Maximum size is ${maxMB} MB.`);
        setState("error");
        return;
      }

      const formData = new FormData();
      formData.append("pluginId", pluginId);
      formData.append("settingKey", settingKey);
      formData.append("file", file);

      try {
        const res = await fetch("/api/plugins/files", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Upload failed");
          setState("error");
          return;
        }

        setFilename(data.filename);
        setState("success");
        onChange(settingKey, data.path);
      } catch {
        setError("Upload failed. Please try again.");
        setState("error");
      }
    },
    [pluginId, settingKey, validation?.maxSize, onChange]
  );

  const handleRemove = useCallback(async () => {
    setState("uploading");
    setError(null);

    try {
      const res = await fetch("/api/plugins/files", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pluginId, settingKey }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to remove file");
        setState("success");
        return;
      }

      setFilename(null);
      setState("idle");
      onChange(settingKey, "");
    } catch {
      setError("Failed to remove file. Please try again.");
      setState("success");
    }
  }, [pluginId, settingKey, onChange]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }

  const acceptAttr = validation?.accept || undefined;

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-medium">{label}</Label>

      {state === "uploading" && (
        <div className="flex items-center gap-3 rounded-lg border border-border/50 p-4">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {hasFile ? "Removing..." : "Uploading..."}
          </span>
        </div>
      )}

      {state === "idle" && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={cn(
            "flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer",
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border/50 hover:border-primary/50 hover:bg-muted/30"
          )}
        >
          <Upload className="size-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Click to upload or drag and drop
          </span>
          {acceptAttr && (
            <span className="text-[11px] text-muted-foreground/70">
              Accepted: {acceptAttr}
            </span>
          )}
        </button>
      )}

      {state === "success" && filename && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
            <span className="text-sm font-mono">{filename}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            className="text-muted-foreground hover:text-destructive gap-1.5 h-7 px-2"
          >
            <Trash2 className="size-3" />
            Remove
          </Button>
        </div>
      )}

      {state === "error" && (
        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
            <span className="text-sm text-destructive">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setState("idle");
            }}
            className="text-xs text-muted-foreground hover:text-foreground underline self-start"
          >
            Try again
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={acceptAttr}
        onChange={handleFileSelect}
        className="hidden"
      />

      {description && (
        <p className="text-[11px] text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
