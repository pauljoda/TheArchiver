"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderInput,
  Copy,
  HardDrive,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

interface MoveCopyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: "move" | "copy";
  paths: string[];
  onComplete: () => void;
}

function FolderTreeNode({
  name,
  path,
  depth,
  selectedPath,
  onSelect,
  disabledPaths,
}: {
  name: string;
  path: string;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  disabledPaths: Set<string>;
}) {
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
    <div>
      <div
        className={cn(
          "flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer transition-colors text-sm",
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
        <span className="truncate font-mono text-xs">{name}</span>
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

export function MoveCopyDialog({
  open,
  onOpenChange,
  action,
  paths,
  onComplete,
}: MoveCopyDialogProps) {
  const [selectedDest, setSelectedDest] = useState<string | null>(null);
  const [rootFolders, setRootFolders] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const isRootSelected = selectedDest === "";

  // Paths that cannot be selected as destination (the source items and their parents)
  const disabledPaths = new Set(paths);

  const loadRoot = useCallback(async () => {
    try {
      const res = await fetch("/api/files?path=");
      if (res.ok) {
        const entries: FileEntry[] = await res.json();
        setRootFolders(entries.filter((e) => e.isDirectory));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (open) {
      setSelectedDest(null);
      loadRoot();
    }
  }, [open, loadRoot]);

  async function handleSubmit() {
    if (selectedDest === null) return;

    setLoading(true);
    try {
      const res = await fetch("/api/files", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          paths,
          destination: selectedDest,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || `Failed to ${action}`);
        return;
      }

      const label = paths.length === 1 ? paths[0].split("/").pop() : `${paths.length} items`;
      const destLabel = selectedDest || "root";
      toast.success(
        `${action === "move" ? "Moved" : "Copied"} ${label} to ${destLabel}`
      );
      onOpenChange(false);
      onComplete();
    } catch {
      toast.error(`Failed to ${action}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading text-sm uppercase tracking-wider">
            {action === "move" ? (
              <FolderInput className="size-4" />
            ) : (
              <Copy className="size-4" />
            )}
            {action === "move" ? "Move" : "Copy"} to...
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-72 rounded-md border border-border/50 bg-muted/10 p-2">
          {/* Root node */}
          <div
            className={cn(
              "flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-colors text-sm",
              isRootSelected
                ? "bg-primary/15 text-primary"
                : "hover:bg-muted/50"
            )}
            onClick={() => setSelectedDest("")}
          >
            <HardDrive
              className={cn(
                "size-4 shrink-0",
                isRootSelected ? "text-primary" : "text-muted-foreground"
              )}
            />
            <span className="font-mono text-xs font-medium">Root</span>
          </div>
          {rootFolders.map((folder) => (
            <FolderTreeNode
              key={folder.path}
              name={folder.name}
              path={folder.path}
              depth={1}
              selectedPath={selectedDest}
              onSelect={setSelectedDest}
              disabledPaths={disabledPaths}
            />
          ))}
        </ScrollArea>
        {selectedDest !== null && (
          <p className="text-xs text-muted-foreground">
            Destination:{" "}
            <span className="font-mono text-foreground">
              /{selectedDest || "root"}
            </span>
          </p>
        )}
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || selectedDest === null}
          >
            {loading
              ? `${action === "move" ? "Moving" : "Copying"}...`
              : action === "move"
                ? "Move"
                : "Copy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
