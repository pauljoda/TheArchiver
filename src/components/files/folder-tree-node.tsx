"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, Folder } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

interface FolderTreeNodeProps {
  name: string;
  path: string;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  disabledPaths: Set<string>;
}

export function FolderTreeNode({
  name,
  path,
  depth,
  selectedPath,
  onSelect,
  disabledPaths,
}: FolderTreeNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<FileEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const isSelected = selectedPath === path;
  const isDisabled = disabledPaths.has(path);

  async function loadChildren() {
    if (loaded) return;
    try {
      const res = await fetch(
        `/api/files?path=${encodeURIComponent(path)}`
      );
      if (res.ok) {
        const entries: FileEntry[] = await res.json();
        setChildren(entries.filter((e) => e.isDirectory));
      }
    } catch {
      // Silently fail — folder may be empty or inaccessible
    }
    setLoaded(true);
  }

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (!expanded) loadChildren();
    setExpanded(!expanded);
  }

  function handleSelect() {
    if (!isDisabled) onSelect(path);
  }

  return (
    <div className="overflow-hidden">
      <div
        className={cn(
          "flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer transition-colors text-sm min-w-0",
          isSelected
            ? "bg-primary/15 text-primary"
            : "hover:bg-muted/50 text-foreground",
          isDisabled && "opacity-40 cursor-not-allowed"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleSelect}
      >
        <button
          className="shrink-0 p-0.5 hover:bg-muted rounded"
          onClick={handleToggle}
        >
          {expanded ? (
            <ChevronDown className="size-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 text-muted-foreground" />
          )}
        </button>
        <Folder
          className={cn(
            "size-4 shrink-0",
            isSelected ? "text-primary" : "text-muted-foreground"
          )}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="truncate font-mono text-xs">{name}</span>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-80 break-all">
            {name}
          </TooltipContent>
        </Tooltip>
      </div>
      {expanded &&
        children.map((child) => (
          <FolderTreeNode
            key={child.path}
            name={child.name}
            path={child.path}
            depth={depth + 1}
            selectedPath={selectedPath}
            onSelect={onSelect}
            disabledPaths={disabledPaths}
          />
        ))}
    </div>
  );
}
