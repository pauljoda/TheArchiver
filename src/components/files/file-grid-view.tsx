"use client";

import {
  Folder,
  File,
  FileVideo,
  Download,
  FolderArchive,
  Trash2,
  Pencil,
  FolderInput,
  Copy,
  MoreHorizontal,
  Heart,
  MessageCircle,
  ArrowUp,
  FileText,
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
import {
  useFolderCardData,
  type PostCardMetadata,
  type FolderCardMetadata,
  type FolderPreview,
} from "@/hooks/use-folder-metadata";
import { FILE_ICONS, getFileIconType } from "@/lib/file-icons";
import type { FileEntry } from "@/lib/types";

interface FileGridViewProps {
  files: FileEntry[];
  currentPath: string;
  selectedPaths: Set<string>;
  hasSelection: boolean;
  onToggleSelect: (path: string, index: number, shiftKey: boolean) => void;
  onNavigate: (path: string) => void;
  onFileOpen?: (file: FileEntry) => void;
  onRename: (file: FileEntry) => void;
  onMoveCopy: (paths: string[], action: "move" | "copy") => void;
  onDelete: (path: string) => void;
}

function isImageFile(name: string): boolean {
  return /\.(jpe?g|png|gif|webp|avif|svg|bmp|ico)$/i.test(name);
}

function isVideoFile(name: string): boolean {
  return /\.(mp4|m4v|mkv|avi|mov|webm|flv|wmv)$/i.test(name);
}

function FolderThumbnail({ preview }: { preview?: FolderPreview }) {
  if (!preview || preview.type === "empty") {
    return (
      <div className="flex items-center justify-center size-full">
        <Folder className="size-10 text-primary/40" />
      </div>
    );
  }

  if (preview.type === "images") {
    const { urls } = preview;
    if (urls.length === 1) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={urls[0]}
          alt=""
          className="size-full object-cover"
          loading="lazy"
        />
      );
    }
    // Multi-image collage
    const gridClass =
      urls.length === 2
        ? "grid-cols-2"
        : urls.length === 3
          ? "grid-cols-2 grid-rows-2"
          : "grid-cols-2 grid-rows-2";
    return (
      <div className={cn("grid size-full gap-0.5", gridClass)}>
        {urls.slice(0, 4).map((url, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={url}
            alt=""
            className={cn(
              "object-cover w-full h-full",
              urls.length === 3 && i === 0 && "row-span-2"
            )}
            loading="lazy"
          />
        ))}
      </div>
    );
  }

  if (preview.type === "names") {
    return (
      <div className="flex flex-wrap items-center justify-center gap-1.5 size-full p-3">
        {preview.items.map((name) => (
          <span
            key={name}
            className="inline-block px-2 py-0.5 text-[10px] font-mono rounded-md bg-muted text-muted-foreground truncate max-w-[120px]"
          >
            {name}
          </span>
        ))}
      </div>
    );
  }

  if (preview.type === "text") {
    return (
      <div className="flex items-center justify-center size-full p-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <FileText className="size-6 text-muted-foreground/30" />
          <p className="text-xs text-muted-foreground/50 line-clamp-3 leading-relaxed">
            {preview.snippet}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center size-full">
      <Folder className="size-10 text-primary/40" />
    </div>
  );
}

function FileThumbnail({ file }: { file: FileEntry }) {
  const iconType = getFileIconType(file.name);

  if (isImageFile(file.name)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/files/download?path=${encodeURIComponent(file.path)}`}
        alt=""
        className="size-full object-cover"
        loading="lazy"
      />
    );
  }

  if (isVideoFile(file.name)) {
    return (
      <div className="relative size-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/files/thumbnail?path=${encodeURIComponent(file.path)}`}
          alt=""
          className="size-full object-cover"
          loading="lazy"
          onError={(e) => {
            // Fallback to icon if thumbnail generation fails
            const target = e.currentTarget;
            target.style.display = "none";
            target.parentElement!.classList.add(
              "flex", "flex-col", "items-center", "justify-center", "gap-1"
            );
            target.parentElement!.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground/40"><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>
              <span class="text-[10px] font-mono text-muted-foreground/40 uppercase">Video</span>
            `;
          }}
        />
        <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5">
          <FileVideo className="size-3 text-white/80" />
        </div>
      </div>
    );
  }

  const IconComponent = FILE_ICONS[iconType] || File;
  return (
    <div className="flex items-center justify-center size-full">
      <IconComponent className="size-10 text-muted-foreground/40" />
    </div>
  );
}

const PLATFORM_ICONS: Record<string, string> = {
  reddit: "Reddit",
  bluesky: "Bluesky",
  twitter: "X",
};

function formatScore(n: number): string {
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + "k";
  return n.toString();
}

function SocialMeta({ meta }: { meta: PostCardMetadata }) {
  const platformLabel = PLATFORM_ICONS[meta.platform] || meta.platform;
  const authorPrefix = meta.platform === "reddit" ? "u/" : "@";

  return (
    <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground/60 mt-1 flex-wrap">
      <span className="text-primary/60">{platformLabel}</span>
      <span>
        {authorPrefix}
        {meta.author}
      </span>
      {meta.score !== undefined && (
        <span className="flex items-center gap-0.5">
          {meta.platform === "reddit" ? (
            <ArrowUp className="size-3" />
          ) : (
            <Heart className="size-3" />
          )}
          {formatScore(meta.score)}
        </span>
      )}
      {meta.commentCount !== undefined && (
        <span className="flex items-center gap-0.5">
          <MessageCircle className="size-3" />
          {formatScore(meta.commentCount)}
        </span>
      )}
    </div>
  );
}

function FileCard({
  file,
  index,
  isSelected,
  hasSelection,
  onToggleSelect,
  onClick,
  onRename,
  onMoveCopy,
  onDelete,
}: {
  file: FileEntry;
  index: number;
  isSelected: boolean;
  hasSelection: boolean;
  onToggleSelect: (path: string, index: number, shiftKey: boolean) => void;
  onClick: () => void;
  onRename: (file: FileEntry) => void;
  onMoveCopy: (paths: string[], action: "move" | "copy") => void;
  onDelete: (path: string) => void;
}) {
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

export function FileGridView({
  files,
  currentPath,
  selectedPaths,
  hasSelection,
  onToggleSelect,
  onNavigate,
  onFileOpen,
  onRename,
  onMoveCopy,
  onDelete,
}: FileGridViewProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 p-4">
      {files.map((file, i) => (
        <FileCard
          key={file.path}
          file={file}
          index={i}
          isSelected={selectedPaths.has(file.path)}
          hasSelection={hasSelection}
          onToggleSelect={onToggleSelect}
          onClick={
            file.isDirectory
              ? () => onNavigate(file.path)
              : () => onFileOpen?.(file)
          }
          onRename={onRename}
          onMoveCopy={onMoveCopy}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
