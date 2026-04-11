"use client";

import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ViewProviderInfo {
  id: string;
  pluginId: string;
  viewId: string;
  label: string;
  icon?: string;
  trackedDirectory: string;
}

interface ViewToggleProps {
  providers: ViewProviderInfo[];
  activeProviderId: string | null;
  onSelect: (providerId: string | null) => void;
}

export function ViewToggle({
  providers,
  activeProviderId,
  onSelect,
}: ViewToggleProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-lg bg-muted/50 p-1",
        "max-w-full overflow-x-auto whitespace-nowrap",
        "[-ms-overflow-style:none] [scrollbar-width:none]",
        "[&::-webkit-scrollbar]:hidden",
      )}
    >
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "h-7 shrink-0 gap-1.5 px-3 text-xs font-heading uppercase tracking-wider",
          activeProviderId === null
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
          key={provider.id}
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 shrink-0 gap-1.5 px-3 text-xs font-heading uppercase tracking-wider",
            activeProviderId === provider.id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => onSelect(provider.id)}
        >
          {provider.label}
        </Button>
      ))}
    </div>
  );
}
