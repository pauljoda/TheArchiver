"use client";

import { useState } from "react";
import {
  Folder,
  File,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  Download,
  Trash2,
  RefreshCw,
  FolderOpen,
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
import { FileBreadcrumb } from "./file-breadcrumb";
import { cn, formatFileSize, formatRelativeDate } from "@/lib/utils";

interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
}

interface FileBrowserProps {
  files: FileEntry[];
  currentPath: string;
  loading: boolean;
  onNavigate: (path: string) => void;
  onRefresh: () => void;
}

const FILE_ICONS: Record<string, typeof File> = {
  image: FileImage,
  video: FileVideo,
  audio: FileAudio,
  archive: FileArchive,
  document: FileText,
  file: File,
};

function getFileIconType(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"].includes(ext))
    return "image";
  if (["mp4", "mkv", "avi", "mov", "webm", "flv", "wmv"].includes(ext))
    return "video";
  if (["mp3", "flac", "wav", "ogg", "aac", "wma", "m4a"].includes(ext))
    return "audio";
  if (["zip", "tar", "gz", "bz2", "7z", "rar", "xz"].includes(ext))
    return "archive";
  if (["pdf", "doc", "docx", "txt", "md", "epub", "cbz", "cbr"].includes(ext))
    return "document";
  return "file";
}

export function FileBrowser({
  files,
  currentPath,
  loading,
  onNavigate,
  onRefresh,
}: FileBrowserProps) {
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function handleDelete(filePath: string) {
    setDeletingPath(filePath);
    try {
      const res = await fetch("/api/files", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath }),
      });
      if (res.ok) {
        setConfirmDelete(null);
        onRefresh();
      }
    } catch (err) {
      console.error("Failed to delete:", err);
    } finally {
      setDeletingPath(null);
    }
  }

  return (
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

      <CardContent className="p-0">
        {files.length === 0 && !currentPath ? (
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
        ) : (
          <div className="divide-y divide-border/50">
            {/* Column header */}
            <div className="flex items-center gap-4 px-5 py-2 text-[10px] font-heading uppercase tracking-wider text-muted-foreground/50">
              <div className="size-8 shrink-0" />
              <div className="flex-1 min-w-0">Name</div>
              <div className="hidden sm:block w-24 text-right shrink-0">Size</div>
              <div className="hidden md:block w-24 text-right shrink-0">Modified</div>
              <div className="w-20 shrink-0" />
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

              return (
                <div
                  key={file.path}
                  className={cn(
                    "group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/30 animate-vault-enter",
                    file.isDirectory && "cursor-pointer"
                  )}
                  style={{ animationDelay: `${i * 20}ms` }}
                  onClick={
                    file.isDirectory
                      ? () => onNavigate(file.path)
                      : undefined
                  }
                >
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

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0 w-20 justify-end">
                    {confirmDelete === file.path ? (
                      <div
                        className="flex items-center gap-1 animate-slide-in"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-7 text-[10px] font-heading uppercase tracking-wider"
                          disabled={deletingPath === file.path}
                          onClick={() => handleDelete(file.path)}
                        >
                          {deletingPath === file.path ? "..." : "Confirm"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[10px]"
                          onClick={() => setConfirmDelete(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div
                        className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {!file.isDirectory && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-muted-foreground hover:text-foreground"
                                asChild
                              >
                                <a
                                  href={`/api/files/download?path=${encodeURIComponent(file.path)}`}
                                  download
                                >
                                  <Download className="size-3.5" />
                                </a>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Download</TooltipContent>
                          </Tooltip>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setConfirmDelete(file.path)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
