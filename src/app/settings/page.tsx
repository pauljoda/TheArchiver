"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { SettingsForm } from "@/components/settings/settings-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SettingData } from "@/lib/types";

const GROUP_LABELS: Record<string, string> = {
  core: "Core",
  notifications: "Notifications",
};

function getGroupLabel(group: string): string {
  if (GROUP_LABELS[group]) return GROUP_LABELS[group];
  if (group.startsWith("plugin:")) return group.slice(7);
  return group;
}

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground font-mono">
              Loading settings...
            </p>
          </div>
        }
      >
        <SettingsContent />
      </Suspense>
    </div>
  );
}

function SettingsContent() {
  const searchParams = useSearchParams();
  const [groups, setGroups] = useState<Record<string, SettingData[]>>({});
  const [activeGroup, setActiveGroup] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      setGroups(data.groups || {});
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    const groupParam = searchParams.get("group");
    if (groupParam && groups[groupParam]) {
      setActiveGroup(groupParam);
    } else {
      setActiveGroup((prev) => {
        if (prev && groups[prev]) return prev;
        const keys = Object.keys(groups);
        return keys.length > 0 ? keys[0] : "";
      });
    }
  }, [groups, searchParams]);

  async function handleSave(updates: Array<{ key: string; value: unknown }>) {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: updates }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to save settings");
    }
    const data = await res.json();
    setGroups(data.groups || {});
  }

  async function handleSettingsAction(
    settingKey: string,
    values: Record<string, unknown>
  ): Promise<{ success: boolean; message: string }> {
    if (settingKey === "core.flaresolverr_test") {
      const baseUrl = String(values["core.flaresolverr_url"] ?? "").trim();
      const res = await fetch("/api/settings/flaresolverr-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl }),
      });
      const data = await res.json();
      return {
        success: data.success === true,
        message:
          typeof data.message === "string"
            ? data.message
            : res.ok
              ? "OK"
              : "Request failed",
      };
    }

    const parts = settingKey.split(".");
    if (parts.length < 3 || parts[0] !== "plugin") {
      return { success: false, message: "Invalid action key" };
    }
    const pluginId = parts[1];
    const actionKey = parts.slice(2).join(".");

    const res = await fetch("/api/plugins/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pluginId, actionKey }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, message: data.error || "Action failed" };
    }
    return { success: data.success, message: data.message };
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground font-mono">
          Loading settings...
        </p>
      </div>
    );
  }

  const groupKeys = Object.keys(groups);

  return (
    <div className="flex flex-col gap-6 animate-vault-enter">
      {/* Page header */}
      <h2 className="text-sm font-heading font-bold uppercase tracking-widest text-muted-foreground">
        Settings
      </h2>

      {groupKeys.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No settings configured yet.
        </p>
      ) : (
        <div className="flex flex-col gap-6 md:flex-row">
          {/* Sidebar nav — horizontal scrolling tabs on mobile, vertical sidebar on md+ */}
          <nav className="flex flex-row gap-1 overflow-x-auto scrollbar-none pb-2 -mb-2 md:flex-col md:w-52 md:shrink-0 md:overflow-x-visible md:pb-0 md:mb-0">
            {groupKeys.map((group) => (
              <Button
                key={group}
                variant="ghost"
                size="sm"
                className={cn(
                  "justify-between shrink-0 text-xs font-heading uppercase tracking-wider transition-all",
                  activeGroup === group
                    ? "bg-primary/10 text-primary hover:bg-primary/15"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setActiveGroup(group)}
              >
                {getGroupLabel(group)}
                {activeGroup === group && (
                  <ChevronRight className="size-3 hidden md:block" />
                )}
              </Button>
            ))}
          </nav>

          {/* Settings form */}
          <div className="flex-1 min-w-0">
            {activeGroup && groups[activeGroup] && (
              <SettingsForm
                key={activeGroup}
                title={getGroupLabel(activeGroup)}
                settings={groups[activeGroup]}
                onSave={handleSave}
                onAction={
                  activeGroup === "core" ||
                  activeGroup.startsWith("plugin:")
                    ? handleSettingsAction
                    : undefined
                }
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
