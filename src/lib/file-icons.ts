import {
  File,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
} from "lucide-react";

export const FILE_ICONS: Record<string, typeof File> = {
  image: FileImage,
  video: FileVideo,
  audio: FileAudio,
  archive: FileArchive,
  document: FileText,
  file: File,
};

export function getFileIconType(name: string): string {
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
