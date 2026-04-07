"use client";

import { useState } from "react";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ActionFieldProps {
  settingKey: string;
  label: string;
  description?: string;
  onAction?: (key: string) => Promise<{ success: boolean; message: string }>;
}

export function ActionField({
  settingKey,
  label,
  description,
  onAction,
}: ActionFieldProps) {
  const [actionLoading, setActionLoading] = useState(false);
  const [actionResult, setActionResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

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
                ? "text-success"
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
