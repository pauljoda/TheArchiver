"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Folder,
  File,
  Download,
  Trash2,
  RefreshCw,
  FolderOpen,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  FolderInput,
  Copy,
  List,
  LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { FileBreadcrumb } from "./file-breadcrumb";
import { FileSelectionToolbar } from "./file-selection-toolbar";
import { CreateFolderDialog } from "./create-folder-dialog";
import { RenameDialog } from "./rename-dialog";
import { MoveCopyDialog } from "./move-copy-dialog";
import { cn, formatFileSize, formatRelativeDate } from "@/lib/utils";
import { toast } from "sonner";
import { FileGridView } from "./file-grid-view";
import { FILE_ICONS, getFileIconType } from "@/lib/file-icons";
import type { FileEntry } from "@/lib/types";

interface FileBrowserProps {
  files: FileEntry[];
  currentPath: string;
  loading: boolean;
  onNavigate: (path: string) => void;
  onRefresh: () => void;
  onFileOpen?: (file: FileEntry) => void;
}

export function FileBrowser({
  files,
  currentPath,
  loading,
  onNavigate,
  onRefresh,
  onFileOpen,
}: FileBrowserProps) {
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  // Hydration-safe: read persisted view mode from cookie after mount
  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)archiver-view-mode=(list|grid)/);
    if (match?.[1] && match[1] !== "list") {
      setViewMode(match[1] as "list" | "grid");
    }
  }, []);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [renameTarget, setRenameTarget] = useState<FileEntry | null>(null);
  const [moveCopyAction, setMoveCopyAction] = useState<{
    paths: string[];
    action: "move" | "copy";
  } | null>(null);
  const [batchDeleting, setBatchDeleting] = useState(false);

  const hasSelection = selectedPaths.size > 0;

  // Persist view mode to cookie (365 day expiry, same-site)
  useEffect(() => {
    document.cookie = `archiver-view-mode=${viewMode};path=/;max-age=${365 * 24 * 60 * 60};samesite=lax`;
  }, [viewMode]);

  // Clear selection on path change
  useEffect(() => {
    setSelectedPaths(new Set());
    setLastClickedIndex(null);
  }, [currentPath]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && hasSelection) {
        setSelectedPaths(new Set());
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "a" && files.length > 0) {
        // Only capture if no input is focused
        if (
          document.activeElement?.tagName !== "INPUT" &&
          document.activeElement?.tagName !== "TEXTAREA"
        ) {
          e.preventDefault();
          setSelectedPaths(new Set(files.map((f) => f.path)));
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasSelection, files]);

  function toggleSelect(filePath: string, index: number, shiftKey: boolean) {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastClickedIndex !== null) {
        const start = Math.min(lastClickedIndex, index);
        const end = Math.max(lastClickedIndex, index);
        for (let i = start; i <= end; i++) {
          next.add(files[i].path);
        }
      } else {
        if (next.has(filePath)) {
          next.delete(filePath);
        } else {
          next.add(filePath);
        }
      }
      return next;
    });
    setLastClickedIndex(index);
  }

  function toggleSelectAll() {
    if (selectedPaths.size === files.length) {
      setSelectedPaths(new Set());
    } else {
      setSelectedPaths(new Set(files.map((f) => f.path)));
    }
  }

  async function handleDelete(filePath: string) {
    try {
      const res = await fetch("/api/files", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath }),
      });
      if (res.ok) {
        toast.success(`Deleted "${filePath.split("/").pop()}"`);
        onRefresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete");
      }
    } catch {
      toast.error("Failed to delete");
    }
  }

  const handleBatchDelete = useCallback(async () => {
    if (selectedPaths.size === 0) return;
    setBatchDeleting(true);
    try {
      const res = await fetch("/api/files", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths: Array.from(selectedPaths) }),
      });
      if (res.ok) {
        toast.success(`Deleted ${selectedPaths.size} item${selectedPaths.size !== 1 ? "s" : ""}`);
        setSelectedPaths(new Set());
        onRefresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete");
      }
    } catch {
      toast.error("Failed to delete");
    } finally {
      setBatchDeleting(false);
    }
  }, [selectedPaths, onRefresh]);

  return (
    <>
      <Card className="overflow-hidden border-border/50">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-card">
          <div className="flex items-center gap-3">
            <CardTitle className="font-heading text-sm uppercase tracking-wider">
              Files
            </CardTitle>
            <Badge variant="secondary" className="font-mono text-[10px]">
              {files.length} item{files.length !== 1 ? "s" : ""}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* View mode toggle */}
            <div className="flex items-center rounded-md border border-border/50 p-0.5 gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "size-7",
                      viewMode === "list"
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setViewMode("list")}
                  >
                    <List className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>List View</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "size-7",
                      viewMode === "grid"
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setViewMode("grid")}
                  >
                    <LayoutGrid className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Grid View</TooltipContent>
              </Tooltip>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowCreateFolder(true)}
                >
                  <FolderPlus className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>New Folder</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-foreground"
                  onClick={onRefresh}
                >
                  <RefreshCw
                    className={cn("size-3.5", loading && "animate-spin")}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>

        {/* Breadcrumb bar */}
        <div className="flex items-center border-b border-border/50 bg-muted/20 px-5 py-2">
          <FileBreadcrumb currentPath={currentPath} onNavigate={onNavigate} />
        </div>

        {/* Selection toolbar */}
        {hasSelection && (
          <FileSelectionToolbar
            selectedCount={selectedPaths.size}
            onMove={() =>
              setMoveCopyAction({
                paths: Array.from(selectedPaths),
                action: "move",
              })
            }
            onCopy={() =>
              setMoveCopyAction({
                paths: Array.from(selectedPaths),
                action: "copy",
              })
            }
            onDelete={handleBatchDelete}
            onClear={() => setSelectedPaths(new Set())}
          />
        )}

        <CardContent className="p-0">
          {files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <FolderOpen className="size-5 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground">
                  {loading ? "Loading..." : "Empty directory"}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {loading
                    ? "Fetching file listing..."
                    : "No files or folders here yet"}
                </p>
              </div>
            </div>
          ) : viewMode === "grid" ? (
            <FileGridView
              files={files}
              currentPath={currentPath}
              selectedPaths={selectedPaths}
              hasSelection={hasSelection}
              onToggleSelect={toggleSelect}
              onNavigate={onNavigate}
              onFileOpen={onFileOpen}
              onRename={(file) => setRenameTarget(file)}
              onMoveCopy={(paths, action) => setMoveCopyAction({ paths, action })}
              onDelete={(path) => handleDelete(path)}
            />
          ) : (
            <div className="divide-y divide-border/50">
              {/* Column header */}
              <div className="flex items-center gap-4 px-5 py-2 text-[10px] font-heading uppercase tracking-wider text-muted-foreground/50">
                <div
                  className={cn(
                    "shrink-0 flex items-center justify-center w-5 transition-opacity",
                    hasSelection ? "opacity-100" : "opacity-0"
                  )}
                >
                  {files.length > 0 && (
                    <Checkbox
                      checked={
                        selectedPaths.size === files.length && files.length > 0
                      }
                      onCheckedChange={toggleSelectAll}
                      className="size-3.5"
                    />
                  )}
                </div>
                <div className="size-8 shrink-0" />
                <div className="flex-1 min-w-0">Name</div>
                <div className="hidden sm:block w-24 text-right shrink-0">Size</div>
                <div className="hidden md:block w-24 text-right shrink-0">Modified</div>
                <div className="w-9 shrink-0" />
              </div>

              {/* Parent directory navigation */}
              {currentPath && (
                <div
                  className="group flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/30 cursor-pointer"
                  onClick={() => {
                    const parent = currentPath.split("/").slice(0, -1).join("/");
                    onNavigate(parent);
                  }}
                >
                  <div className="w-5 shrink-0" />
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <FolderOpen className="size-4" />
                  </div>
                  <p className="text-sm font-mono text-muted-foreground">..</p>
                </div>
              )}

              {files.map((file, i) => {
                const IconComponent = file.isDirectory
                  ? Folder
                  : FILE_ICONS[getFileIconType(file.name)] || File;
                const isSelected = selectedPaths.has(file.path);

                return (
                  <div
                    key={file.path}
                    className={cn(
                      "group flex items-center gap-4 px-5 py-3.5 transition-colors animate-vault-enter cursor-pointer",
                      isSelected
                        ? "bg-primary/5"
                        : "hover:bg-muted/30"
                    )}
                    style={{ animationDelay: `${i * 20}ms` }}
                    onClick={
                      file.isDirectory
                        ? () => onNavigate(file.path)
                        : () => onFileOpen?.(file)
                    }
                  >
                    {/* Checkbox */}
                    <div
                      className={cn(
                        "shrink-0 flex items-center justify-center w-5 transition-opacity",
                        hasSelection || isSelected
                          ? "opacity-100"
                          : "opacity-0 group-hover:opacity-100"
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(file.path, i, false)}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (e.shiftKey) {
                            e.preventDefault();
                            toggleSelect(file.path, i, true);
                          }
                        }}
                        className="size-3.5"
                      />
                    </div>

                    {/* Icon */}
                    <div
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                        file.isDirectory
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <IconComponent className="size-4" />
                    </div>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-sm truncate",
                          file.isDirectory
                            ? "font-medium"
                            : "text-muted-foreground"
                        )}
                      >
                        {file.name}
                      </p>
                    </div>

                    {/* Size */}
                    <div className="hidden sm:block w-24 text-right shrink-0">
                      <span className="text-xs font-mono text-muted-foreground/60">
                        {file.isDirectory ? "--" : formatFileSize(file.size)}
                      </span>
                    </div>

                    {/* Modified */}
                    <div className="hidden md:block w-24 text-right shrink-0">
                      <span className="text-xs font-mono text-muted-foreground/60">
                        {formatRelativeDate(file.modifiedAt)}
                      </span>
                    </div>

                    {/* Actions dropdown */}
                    <div
                      className="shrink-0 w-9 flex justify-end"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "size-7 text-muted-foreground hover:text-foreground transition-opacity",
                              "sm:opacity-0 sm:group-hover:opacity-100",
                              "sm:focus-visible:opacity-100",
                              "sm:data-[state=open]:opacity-100"
                            )}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          {!file.isDirectory && (
                            <DropdownMenuItem asChild>
                              <a
                                href={`/api/files/download?path=${encodeURIComponent(file.path)}`}
                                download
                                className="gap-2"
                              >
                                <Download className="size-4" />
                                Download
                              </a>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="gap-2"
                            onSelect={() => setRenameTarget(file)}
                          >
                            <Pencil className="size-4" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="gap-2"
                            onSelect={() =>
                              setMoveCopyAction({
                                paths: [file.path],
                                action: "move",
                              })
                            }
                          >
                            <FolderInput className="size-4" />
                            Move to...
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="gap-2"
                            onSelect={() =>
                              setMoveCopyAction({
                                paths: [file.path],
                                action: "copy",
                              })
                            }
                          >
                            <Copy className="size-4" />
                            Copy to...
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                            onSelect={() => handleDelete(file.path)}
                          >
                            <Trash2 className="size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CreateFolderDialog
        open={showCreateFolder}
        onOpenChange={setShowCreateFolder}
        currentPath={currentPath}
        onCreated={onRefresh}
      />

      {renameTarget && (
        <RenameDialog
          open={!!renameTarget}
          onOpenChange={(open) => {
            if (!open) setRenameTarget(null);
          }}
          filePath={renameTarget.path}
          fileName={renameTarget.name}
          onRenamed={onRefresh}
        />
      )}

      {moveCopyAction && (
        <MoveCopyDialog
          open={!!moveCopyAction}
          onOpenChange={(open) => {
            if (!open) setMoveCopyAction(null);
          }}
          action={moveCopyAction.action}
          paths={moveCopyAction.paths}
          onComplete={() => {
            setSelectedPaths(new Set());
            onRefresh();
          }}
        />
      )}
    </>
  );
}
