"use client";

import { useState, useRef, useEffect } from "react";
import { Save, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SettingField } from "./setting-field";
import { cn } from "@/lib/utils";

interface SettingData {
  key: string;
  type: "string" | "number" | "boolean" | "password" | "select" | "action" | "site-directory-map" | "extension-directory-map" | "file";
  label: string;
  description?: string;
  value: string | number | boolean | null;
  hidden?: boolean;
  validation?: {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
    options?: Array<{ label: string; value: string }>;
  };
}

interface SettingsFormProps {
  title: string;
  settings: SettingData[];
  onSave: (updates: Array<{ key: string; value: unknown }>) => Promise<void>;
  onAction?: (key: string) => Promise<{ success: boolean; message: string }>;
}

export function SettingsForm({
  title,
  settings,
  onSave,
  onAction,
}: SettingsFormProps) {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    for (const s of settings) {
      initial[s.key] = s.value;
    }
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  function handleChange(key: string, value: string | number | boolean) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const updates = Object.entries(values)
        .filter(([key]) => {
          const setting = settings.find((s) => s.key === key);
          return setting != null && setting.type !== "action" && setting.type !== "file";
        })
        .map(([key, value]) => ({ key, value }));
      await onSave(updates);
      setSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleAction(
    key: string
  ): Promise<{ success: boolean; message: string }> {
    if (!onAction) return { success: false, message: "No action handler" };
    try {
      const updates = Object.entries(values)
        .filter(([k]) => {
          const setting = settings.find((s) => s.key === k);
          return setting != null && setting.type !== "action" && setting.type !== "file";
        })
        .map(([k, value]) => ({ key: k, value }));
      await onSave(updates);
    } catch (err) {
      return {
        success: false,
        message: `Failed to save settings before action: ${err instanceof Error ? err.message : "unknown error"}`,
      };
    }
    return onAction(key);
  }

  return (
    <Card className="overflow-hidden border-border/50">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-card">
        <CardTitle className="font-heading text-sm uppercase tracking-wider">
          {title}
        </CardTitle>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-heading animate-vault-fade">
              <Check className="size-3" />
              Saved
            </span>
          )}
          {error && (
            <span className="text-xs text-destructive">{error}</span>
          )}
          <Button
            onClick={handleSave}
            disabled={saving}
            size="sm"
            className={cn(
              "gap-1.5 font-heading text-xs uppercase tracking-wider",
              saved && "bg-emerald-600 hover:bg-emerald-700"
            )}
          >
            <Save className="size-3" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-5">
        {settings
          .filter((s) => !s.hidden)
          .map((s) => (
            <SettingField
              key={s.key}
              settingKey={s.key}
              type={s.type}
              label={s.label}
              description={s.description}
              value={values[s.key] as string | number | boolean | null}
              validation={s.validation}
              onChange={handleChange}
              onAction={handleAction}
            />
          ))}
      </CardContent>
    </Card>
  );
}
