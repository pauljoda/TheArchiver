"use client";

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
  Pencil,
  FolderInput,
  Copy,
  MoreHorizontal,
  Heart,
  MessageCircle,
  ArrowUp,
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
import { useFolderThumbnail } from "@/hooks/use-folder-thumbnail";
import {
  useFolderMetadata,
  type PostCardMetadata,
} from "@/hooks/use-folder-metadata";

interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
}

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

function isImageFile(name: string): boolean {
  return /\.(jpe?g|png|gif|webp|avif|svg|bmp|ico)$/i.test(name);
}

function FolderThumbnail({ folderPath }: { folderPath: string }) {
  const thumbnailUrl = useFolderThumbnail(folderPath);

  if (thumbnailUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={thumbnailUrl}
        alt=""
        className="size-full object-cover"
        loading="lazy"
      />
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

  if (iconType === "video") {
    return (
      <div className="flex flex-col items-center justify-center size-full gap-1">
        <FileVideo className="size-10 text-muted-foreground/40" />
        <span className="text-[10px] font-mono text-muted-foreground/40 uppercase">
          Video
        </span>
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
      <span>{authorPrefix}{meta.author}</span>
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
  const meta = useFolderMetadata(file.isDirectory ? file.path : "");
  const displayName = meta ? meta.title : file.name;

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
          <FolderThumbnail folderPath={file.path} />
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
        {meta ? (
          <SocialMeta meta={meta} />
        ) : (
          <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground/60 mt-1">
            <span>{file.isDirectory ? "Folder" : formatFileSize(file.size)}</span>
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
