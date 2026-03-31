"use client";

import { useState } from "react";
import { Eye, EyeOff, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SiteDirectoryMap } from "./site-directory-map";
import { ExtensionDirectoryMap } from "./extension-directory-map";
import { FileUploadField } from "./file-upload-field";
import { cn } from "@/lib/utils";

interface SettingFieldProps {
  settingKey: string;
  type: "string" | "number" | "boolean" | "password" | "select" | "action" | "site-directory-map" | "extension-directory-map" | "file";
  label: string;
  description?: string;
  value: string | number | boolean | null;
  validation?: {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
    options?: Array<{ label: string; value: string }>;
    accept?: string;
    maxSize?: number;
  };
  onChange: (key: string, value: string | number | boolean) => void;
  onAction?: (key: string) => Promise<{ success: boolean; message: string }>;
}

export function SettingField({
  settingKey,
  type,
  label,
  description,
  value,
  validation,
  onChange,
  onAction,
}: SettingFieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionResult, setActionResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const id = `setting-${settingKey}`;

  if (type === "action") {
    async function handleAction() {
      if (!onAction) return;
      setActionLoading(true);
      setActionResult(null);
      try {
        const result = await onAction(settingKey);
        setActionResult(result);
      } catch (e) {
        setActionResult({
          success: false,
          message: e instanceof Error ? e.message : "Action failed",
        });
      } finally {
        setActionLoading(false);
      }
    }

    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleAction}
            disabled={actionLoading}
            size="sm"
            className="gap-1.5 font-heading text-xs uppercase tracking-wider"
          >
            <Zap className="size-3" />
            {actionLoading ? "Running..." : label}
          </Button>
          {actionResult && (
            <span
              className={cn(
                "text-xs font-medium animate-vault-fade",
                actionResult.success
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-destructive"
              )}
            >
              {actionResult.message}
            </span>
          )}
        </div>
        {description && (
          <p className="text-[11px] text-muted-foreground">{description}</p>
        )}
      </div>
    );
  }

  if (type === "site-directory-map") {
    return (
      <SiteDirectoryMap
        settingKey={settingKey}
        label={label}
        description={description}
        value={value as string | null}
        options={validation?.options ?? []}
        onChange={onChange}
      />
    );
  }

  if (type === "extension-directory-map") {
    return (
      <ExtensionDirectoryMap
        settingKey={settingKey}
        label={label}
        description={description}
        value={value as string | null}
        options={validation?.options ?? []}
        onChange={onChange}
      />
    );
  }

  if (type === "file") {
    // Extract pluginId from settingKey (format: plugin.{pluginId}.{key})
    const parts = settingKey.split(".");
    const pluginId = parts.length >= 3 ? parts[1] : "";
    return (
      <FileUploadField
        settingKey={parts.length >= 3 ? parts.slice(2).join(".") : settingKey}
        pluginId={pluginId}
        label={label}
        description={description}
        value={value as string | null}
        validation={validation}
        onChange={onChange}
      />
    );
  }

  if (type === "boolean") {
    return (
      <div className="flex items-center justify-between rounded-lg border border-border/50 p-4 transition-colors hover:bg-muted/30">
        <div className="flex flex-col gap-0.5">
          <Label htmlFor={id} className="text-sm font-medium cursor-pointer">
            {label}
          </Label>
          {description && (
            <p className="text-[11px] text-muted-foreground">{description}</p>
          )}
        </div>
        <Switch
          id={id}
          checked={value === true || value === "true"}
          onCheckedChange={(checked) => onChange(settingKey, checked)}
        />
      </div>
    );
  }

  if (type === "select" && validation?.options) {
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <Select
          value={String(value ?? "")}
          onValueChange={(v) => onChange(settingKey, v)}
        >
          <SelectTrigger id={id} className="font-mono text-sm">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {validation.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {description && (
          <p className="text-[11px] text-muted-foreground">{description}</p>
        )}
      </div>
    );
  }

  if (type === "password") {
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <div className="relative">
          <Input
            id={id}
            type={showPassword ? "text" : "password"}
            value={String(value ?? "")}
            onChange={(e) => onChange(settingKey, e.target.value)}
            className="pr-10 font-mono text-sm"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent text-muted-foreground hover:text-foreground"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? (
              <EyeOff className="size-3.5" />
            ) : (
              <Eye className="size-3.5" />
            )}
          </Button>
        </div>
        {description && (
          <p className="text-[11px] text-muted-foreground">{description}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      <Input
        id={id}
        type={type === "number" ? "number" : "text"}
        value={String(value ?? "")}
        onChange={(e) =>
          onChange(
            settingKey,
            type === "number" ? Number(e.target.value) : e.target.value
          )
        }
        min={validation?.min}
        max={validation?.max}
        className="font-mono text-sm"
      />
      {description && (
        <p className="text-[11px] text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
