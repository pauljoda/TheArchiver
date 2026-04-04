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
    <div className="flex items-center justify-between border-b border-primary/20 bg-primary/5 px-5 py-2 animate-vault-enter">
      <span className="text-xs font-heading uppercase tracking-wider text-primary">
        {selectedCount} selected
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={onMove}
        >
          <FolderInput className="size-3.5" />
          Move
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={onCopy}
        >
          <Copy className="size-3.5" />
          Copy
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={onDownloadZip}
        >
          <Download className="size-3.5" />
          Download Zip
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={onDelete}
        >
          <Trash2 className="size-3.5" />
          Delete
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground"
          onClick={onClear}
        >
          <X className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
