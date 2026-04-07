"use client";

import {
  Download,
  FolderArchive,
  Trash2,
  Pencil,
  FolderInput,
  Copy,
  MoreHorizontal,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, formatFileSize, formatRelativeDate } from "@/lib/utils";
import { useFolderCardData } from "@/hooks/use-folder-metadata";
import type { FileEntry } from "@/lib/types";
import { FolderThumbnail } from "./folder-thumbnail";
import { FileThumbnail } from "./file-thumbnail";
import { SocialMeta } from "./social-meta";

interface FileCardProps {
  file: FileEntry;
  index: number;
  isSelected: boolean;
  hasSelection: boolean;
  onToggleSelect: (path: string, index: number, shiftKey: boolean) => void;
  onClick: () => void;
  onRename: (file: FileEntry) => void;
  onMoveCopy: (paths: string[], action: "move" | "copy") => void;
  onDelete: (path: string) => void;
}

export function FileCard({
  file,
  index,
  isSelected,
  hasSelection,
  onToggleSelect,
  onClick,
  onRename,
  onMoveCopy,
  onDelete,
}: FileCardProps) {
  const cardData = useFolderCardData(file.isDirectory ? file.path : "");
  const post = cardData?.post;
  const displayName = post ? post.title : file.name;

  return (
    <div
      className={cn(
        "group relative rounded-xl border overflow-hidden cursor-pointer transition-all animate-vault-enter",
        isSelected
          ? "border-primary ring-2 ring-primary/20 bg-card"
          : "border-border/50 bg-card hover:border-primary/50 hover:shadow-sm"
      )}
      style={{ animationDelay: `${index * 20}ms` }}
      onClick={onClick}
    >
      {/* Thumbnail */}
      <div className="aspect-[16/10] bg-muted relative overflow-hidden">
        {file.isDirectory ? (
          <FolderThumbnail preview={cardData?.preview} />
        ) : (
          <FileThumbnail file={file} />
        )}

        {/* Checkbox overlay */}
        <div
          className={cn(
            "absolute top-2 left-2 transition-opacity",
            hasSelection || isSelected
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect(file.path, index, false)}
            onClick={(e) => {
              e.stopPropagation();
              if (e.shiftKey) {
                e.preventDefault();
                onToggleSelect(file.path, index, true);
              }
            }}
            className="size-4 bg-background/80 backdrop-blur-sm"
          />
        </div>

        {/* Context menu */}
        <div
          className={cn(
            "absolute top-2 right-2 transition-opacity",
            "opacity-0 group-hover:opacity-100"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="size-7 bg-background/80 backdrop-blur-sm hover:bg-background"
              >
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem asChild>
                <a
                  href={
                    file.isDirectory
                      ? `/api/files/zip?path=${encodeURIComponent(file.path)}`
                      : `/api/files/download?path=${encodeURIComponent(file.path)}`
                  }
                  download
                  className="gap-2"
                >
                  {file.isDirectory ? (
                    <>
                      <FolderArchive className="size-4" />
                      Download Zip
                    </>
                  ) : (
                    <>
                      <Download className="size-4" />
                      Download
                    </>
                  )}
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2"
                onSelect={() => onRename(file)}
              >
                <Pencil className="size-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2"
                onSelect={() => onMoveCopy([file.path], "move")}
              >
                <FolderInput className="size-4" />
                Move to...
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2"
                onSelect={() => onMoveCopy([file.path], "copy")}
              >
                <Copy className="size-4" />
                Copy to...
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                onSelect={() => onDelete(file.path)}
              >
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Body */}
      <div className="p-3">
        <p
          className={cn(
            "text-sm truncate",
            file.isDirectory ? "font-medium" : "text-muted-foreground"
          )}
          title={displayName}
        >
          {displayName}
        </p>
        {post ? (
          <SocialMeta meta={post} />
        ) : (
          <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground/60 mt-1">
            <span>
              {file.isDirectory
                ? cardData
                  ? `${cardData.itemCount} item${cardData.itemCount !== 1 ? "s" : ""}`
                  : "Folder"
                : formatFileSize(file.size)}
            </span>
            <span>{formatRelativeDate(file.modifiedAt)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
