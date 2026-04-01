"use client";

import {
  File,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFileSize, formatRelativeDate } from "@/lib/utils";

interface GenericPreviewProps {
  filePath: string;
  fileName: string;
  fileSize: number;
  modifiedAt: string;
}

const CATEGORY_ICONS: Record<string, typeof File> = {
  image: FileImage,
  video: FileVideo,
  audio: FileAudio,
  archive: FileArchive,
  document: FileText,
  file: File,
};

function getCategory(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"].includes(ext)) return "image";
  if (["mp4", "mkv", "avi", "mov", "webm", "flv", "wmv"].includes(ext)) return "video";
  if (["mp3", "flac", "wav", "ogg", "aac", "wma", "m4a"].includes(ext)) return "audio";
  if (["zip", "tar", "gz", "bz2", "7z", "rar", "xz"].includes(ext)) return "archive";
  if (["pdf", "doc", "docx", "txt", "md", "epub", "cbz", "cbr"].includes(ext)) return "document";
  return "file";
}

export function GenericPreview({
  filePath,
  fileName,
  fileSize,
  modifiedAt,
}: GenericPreviewProps) {
  const category = getCategory(fileName);
  const Icon = CATEGORY_ICONS[category] || File;
  const ext = fileName.split(".").pop()?.toUpperCase() || "FILE";

  return (
    <div className="flex flex-col items-center justify-center gap-6 size-full">
      <div className="flex size-20 items-center justify-center rounded-2xl bg-muted ring-1 ring-border/50">
        <Icon className="size-10 text-muted-foreground" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-medium">{fileName}</p>
        <p className="text-xs text-muted-foreground">
          {ext} file &middot; {formatFileSize(fileSize)} &middot; Modified {formatRelativeDate(modifiedAt)}
        </p>
      </div>
      <Button variant="outline" size="sm" asChild>
        <a href={`/api/files/download?path=${encodeURIComponent(filePath)}`} download>
          <Download className="size-4 mr-2" />
          Download
        </a>
      </Button>
    </div>
  );
}
