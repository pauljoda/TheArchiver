"use client";

import { Button } from "@/components/ui/button";
import { FolderInput, Copy, Download, Trash2, X } from "lucide-react";

interface FileSelectionToolbarProps {
  selectedCount: number;
  onMove: () => void;
  onCopy: () => void;
  onDownloadZip: () => void;
  onDelete: () => void;
  onClear: () => void;
}

export function FileSelectionToolbar({
  selectedCount,
  onMove,
  onCopy,
  onDownloadZip,
  onDelete,
  onClear,
}: FileSelectionToolbarProps) {
  return (
    <div
      className="relative z-10 flex flex-col gap-2 border-b border-primary/20 bg-primary/5 px-5 py-2 animate-vault-enter touch-manipulation sm:flex-row sm:items-center sm:justify-between sm:gap-0"
      role="toolbar"
      aria-label="Selection actions"
    >
      <span className="shrink-0 text-xs font-heading uppercase tracking-wider text-primary">
        {selectedCount} selected
      </span>
      <div className="flex w-full flex-wrap items-center justify-end gap-1 sm:w-auto sm:flex-nowrap">
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5 text-xs sm:h-7"
          onClick={onMove}
        >
          <FolderInput className="size-3.5" />
          Move
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5 text-xs sm:h-7"
          onClick={onCopy}
        >
          <Copy className="size-3.5" />
          Copy
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5 text-xs sm:h-7"
          onClick={onDownloadZip}
        >
          <Download className="size-3.5" />
          Download Zip
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 sm:h-7"
          onClick={onDelete}
        >
          <Trash2 className="size-3.5" />
          Delete
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 text-muted-foreground sm:size-7"
          onClick={onClear}
          aria-label="Clear selection"
        >
          <X className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
