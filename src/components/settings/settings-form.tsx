"use client";

import { useState, useRef, useEffect } from "react";
import { Save, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SettingField } from "./setting-field";
import { cn } from "@/lib/utils";
import type { SettingData } from "@/lib/types";

interface SettingsFormProps {
  title: string;
  settings: SettingData[];
  onSave: (updates: Array<{ key: string; value: unknown }>) => Promise<void>;
  onAction?: (
    key: string,
    values: Record<string, unknown>
  ) => Promise<{ success: boolean; message: string }>;
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
    return onAction(key, values);
  }

  const visible = settings.filter((s) => !s.hidden);
  const hasSections = visible.some((s) => s.section);

  // Group settings by section, preserving order
  const sections: Array<{ name: string; items: typeof visible }> = [];
  if (hasSections) {
    const seen = new Set<string>();
    for (const s of visible) {
      const name = s.section || "";
      if (!seen.has(name)) {
        seen.add(name);
        sections.push({ name, items: [] });
      }
      sections.find((sec) => sec.name === name)!.items.push(s);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Save header */}
      <Card className="overflow-hidden border-border/50">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-card">
          <CardTitle className="font-heading text-sm uppercase tracking-wider">
            {title}
          </CardTitle>
          <div className="flex items-center gap-2">
            {saved && (
              <span className="flex items-center gap-1 text-xs text-success font-heading animate-vault-fade">
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
                saved && "bg-success hover:bg-success/90"
              )}
            >
              <Save className="size-3" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </CardHeader>

        {/* Non-sectioned: render all settings in one card */}
        {!hasSections && (
          <CardContent className="flex flex-col gap-4 p-5">
            {visible.map((s) => (
              <SettingField
                key={s.key}
                settingKey={s.key}
                type={s.type}
                label={s.label}
                description={s.description}
                value={values[s.key] as string | number | boolean | null}
                validation={s.validation}
                onChange={handleChange}
                onAction={onAction ? handleAction : undefined}
              />
            ))}
          </CardContent>
        )}
      </Card>

      {/* Sectioned: each section gets its own collapsible card */}
      {hasSections &&
        sections.map((section) => (
          <SettingsSection
            key={section.name || "__default"}
            name={section.name}
            count={section.items.length}
            defaultOpen={section === sections[0]}
          >
            {section.items.map((s) => (
              <SettingField
                key={s.key}
                settingKey={s.key}
                type={s.type}
                label={s.label}
                description={s.description}
                value={values[s.key] as string | number | boolean | null}
                validation={s.validation}
                onChange={handleChange}
                onAction={onAction ? handleAction : undefined}
              />
            ))}
          </SettingsSection>
        ))}
    </div>
  );
}

/** Collapsible section card for grouped settings */
function SettingsSection({
  name,
  count,
  defaultOpen,
  children,
}: {
  name: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <Card className="overflow-hidden border-border/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between px-5 py-3.5 text-left transition-colors",
          "hover:bg-muted/50",
          open && "border-b border-border/50"
        )}
      >
        <div className="flex items-center gap-3">
          <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-foreground">
            {name || "General"}
          </h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-mono font-medium text-muted-foreground">
            {count}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <CardContent className="flex flex-col gap-4 p-5">
          {children}
        </CardContent>
      )}
    </Card>
  );
}
