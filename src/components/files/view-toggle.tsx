"use client";

import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ViewProviderInfo {
  pluginId: string;
  viewId: string;
  label: string;
  icon?: string;
}

interface ViewToggleProps {
  providers: ViewProviderInfo[];
  activeViewId: string | null;
  onSelect: (viewId: string | null) => void;
}

export function ViewToggle({
  providers,
  activeViewId,
  onSelect,
}: ViewToggleProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1">
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "h-7 gap-1.5 px-3 text-xs font-heading uppercase tracking-wider",
          activeViewId === null
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
        onClick={() => onSelect(null)}
      >
        <FolderOpen className="size-3.5" />
        Files
      </Button>
      {providers.map((provider) => (
        <Button
          key={provider.viewId}
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 gap-1.5 px-3 text-xs font-heading uppercase tracking-wider",
            activeViewId === provider.viewId
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => onSelect(provider.viewId)}
        >
          {provider.label}
        </Button>
      ))}
    </div>
  );
}
