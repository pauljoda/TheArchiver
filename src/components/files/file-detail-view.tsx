"use client";

import { useEffect, useMemo, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Download,
  Pencil,
  FolderInput,
  Copy,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { RenameDialog } from "./rename-dialog";
import { MoveCopyDialog } from "./move-copy-dialog";
import { getPreviewType } from "@/lib/file-preview";
import { formatFileSize, formatRelativeDate } from "@/lib/utils";
import { toast } from "sonner";
import type { FileEntry } from "@/lib/types";

import { ImagePreview } from "./previews/image-preview";
import { VideoPreview } from "./previews/video-preview";
import { AudioPreview } from "./previews/audio-preview";
import { TextPreview } from "./previews/text-preview";
import { PdfPreview } from "./previews/pdf-preview";
import { GenericPreview } from "./previews/generic-preview";
import { PluginPreview } from "./previews/plugin-preview";

interface FileDetailViewProps {
  file: FileEntry;
  files: FileEntry[];
  onClose: () => void;
  onFileChange: (file: FileEntry) => void;
  onRefresh: () => void;
}

export function FileDetailView({
  file,
  files,
  onClose,
  onFileChange,
  onRefresh,
}: FileDetailViewProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [renameTarget, setRenameTarget] = useState<FileEntry | null>(null);
  const [moveCopyAction, setMoveCopyAction] = useState<{
    paths: string[];
    action: "move" | "copy";
  } | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  // Only navigate between files (skip directories)
  const navigableFiles = useMemo(
    () => files.filter((f) => !f.isDirectory),
    [files]
  );

  const currentIndex = useMemo(
    () => navigableFiles.findIndex((f) => f.path === file.path),
    [navigableFiles, file.path]
  );

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < navigableFiles.length - 1;

  const goPrev = useCallback(() => {
    if (hasPrev) onFileChange(navigableFiles[currentIndex - 1]);
  }, [hasPrev, navigableFiles, currentIndex, onFileChange]);

  const goNext = useCallback(() => {
    if (hasNext) onFileChange(navigableFiles[currentIndex + 1]);
  }, [hasNext, navigableFiles, currentIndex, onFileChange]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't capture when a dialog input is focused
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      )
        return;

      switch (e.key) {
        case "Escape":
          e.preventDefault();
          onClose();
          break;
        case "ArrowLeft":
          e.preventDefault();
          goPrev();
          break;
        case "ArrowRight":
          e.preventDefault();
          goNext();
          break;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, goPrev, goNext]);

  async function handleDelete() {
    try {
      const res = await fetch("/api/files", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: file.path }),
      });
      if (res.ok) {
        toast.success(`Deleted "${file.name}"`);
        onRefresh();
        // Advance to next, then prev, or close
        if (hasNext) {
          onFileChange(navigableFiles[currentIndex + 1]);
        } else if (hasPrev) {
          onFileChange(navigableFiles[currentIndex - 1]);
        } else {
          onClose();
        }
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete");
      }
    } catch {
      toast.error("Failed to delete");
    }
  }

  const previewType = getPreviewType(file.name);
  const ext = file.name.split(".").pop()?.toUpperCase() || "FILE";

  // For "generic" files, check if a plugin can handle the extension
  const [pluginPreviewId, setPluginPreviewId] = useState<string | null>(null);
  useEffect(() => {
    if (previewType !== "generic") {
      setPluginPreviewId(null);
      return;
    }
    const fileExt = file.name.split(".").pop()?.toLowerCase() || "";
    if (!fileExt) return;
    fetch(`/api/plugins/preview-provider?ext=${encodeURIComponent(fileExt)}`)
      .then((res) => (res.ok && res.status !== 204 ? res.json() : null))
      .then((data) => setPluginPreviewId(data?.pluginId ?? null))
      .catch(() => setPluginPreviewId(null));
  }, [previewType, file.name]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm animate-vault-enter"
      tabIndex={-1}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card/80 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <p className="text-sm font-mono truncate">{file.name}</p>
          {navigableFiles.length > 1 && (
            <span className="text-[10px] font-mono text-muted-foreground/50 shrink-0">
              {currentIndex + 1} / {navigableFiles.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
                onClick={() => setShowInfo((s) => !s)}
              >
                <Info className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>File Info</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-5 mx-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground" asChild>
                <a href={`/api/files/download?path=${encodeURIComponent(file.path)}`} download>
                  <Download className="size-3.5" />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Download</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
                onClick={() => setRenameTarget(file)}
              >
                <Pencil className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Rename</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
                onClick={() =>
                  setMoveCopyAction({ paths: [file.path], action: "move" })
                }
              >
                <FolderInput className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Move to...</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
                onClick={() =>
                  setMoveCopyAction({ paths: [file.path], action: "copy" })
                }
              >
                <Copy className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy to...</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleDelete}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-5 mx-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
                onClick={onClose}
              >
                <X className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Close (Esc)</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 min-h-0 relative">
        {/* Prev button */}
        {hasPrev && (
          <button
            aria-label="Previous file"
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 flex size-10 items-center justify-center rounded-full bg-card/80 border border-border/50 text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
            onClick={goPrev}
          >
            <ChevronLeft className="size-5" />
          </button>
        )}

        {/* Preview */}
        <div className="flex-1 min-w-0 p-4">
          {previewType === "image" && (
            <ImagePreview key={file.path} filePath={file.path} />
          )}
          {previewType === "video" && (
            <VideoPreview key={file.path} filePath={file.path} fileName={file.name} />
          )}
          {previewType === "audio" && (
            <AudioPreview key={file.path} filePath={file.path} fileName={file.name} />
          )}
          {previewType === "text" && (
            <TextPreview key={file.path} filePath={file.path} fileName={file.name} fileSize={file.size} />
          )}
          {previewType === "pdf" && (
            <PdfPreview key={file.path} filePath={file.path} />
          )}
          {previewType === "generic" && pluginPreviewId && (
            <PluginPreview
              key={file.path}
              pluginId={pluginPreviewId}
              file={file}
            />
          )}
          {previewType === "generic" && !pluginPreviewId && (
            <GenericPreview
              filePath={file.path}
              fileName={file.name}
              fileSize={file.size}
              modifiedAt={file.modifiedAt}
            />
          )}
        </div>

        {/* Next button */}
        {hasNext && (
          <button
            aria-label="Next file"
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex size-10 items-center justify-center rounded-full bg-card/80 border border-border/50 text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
            onClick={goNext}
          >
            <ChevronRight className="size-5" />
          </button>
        )}

        {/* Info panel */}
        {showInfo && (
          <div className="w-64 shrink-0 border-l border-border/50 bg-card/50 p-4 space-y-4 overflow-auto">
            <h3 className="text-xs font-heading uppercase tracking-wider text-muted-foreground/60">
              File Info
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground/40">Name</p>
                <p className="text-sm font-mono break-all">{file.name}</p>
              </div>
              <div>
                <p className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground/40">Path</p>
                <p className="text-sm font-mono break-all text-muted-foreground">{file.path}</p>
              </div>
              <div>
                <p className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground/40">Type</p>
                <p className="text-sm font-mono text-muted-foreground">{ext}</p>
              </div>
              <div>
                <p className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground/40">Size</p>
                <p className="text-sm font-mono text-muted-foreground">{formatFileSize(file.size)}</p>
              </div>
              <div>
                <p className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground/40">Modified</p>
                <p className="text-sm font-mono text-muted-foreground">{formatRelativeDate(file.modifiedAt)}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      {renameTarget && (
        <RenameDialog
          open={!!renameTarget}
          onOpenChange={(open) => {
            if (!open) setRenameTarget(null);
          }}
          filePath={renameTarget.path}
          fileName={renameTarget.name}
          onRenamed={() => {
            onRefresh();
            onClose();
          }}
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
            onRefresh();
            if (moveCopyAction.action === "move") onClose();
          }}
        />
      )}
    </div>,
    document.body
  );
}
