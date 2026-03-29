"use client";

import { HardDrive, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FileBreadcrumbProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export function FileBreadcrumb({ currentPath, onNavigate }: FileBreadcrumbProps) {
  const segments = currentPath ? currentPath.split("/").filter(Boolean) : [];

  return (
    <nav className="flex items-center gap-1 text-xs font-mono overflow-x-auto">
      <Button
        variant="ghost"
        size="sm"
        className="h-6 gap-1 px-1.5 text-xs font-mono text-muted-foreground hover:text-foreground shrink-0"
        onClick={() => onNavigate("")}
      >
        <HardDrive className="size-3" />
        root
      </Button>

      {segments.map((segment, i) => {
        const segPath = segments.slice(0, i + 1).join("/");
        const isLast = i === segments.length - 1;

        return (
          <span key={segPath} className="flex items-center gap-1 shrink-0">
            <ChevronRight className="size-3 text-muted-foreground/40" />
            {isLast ? (
              <span className="text-xs font-mono text-foreground px-1.5">
                {segment}
              </span>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-xs font-mono text-muted-foreground hover:text-foreground"
                onClick={() => onNavigate(segPath)}
              >
                {segment}
              </Button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
