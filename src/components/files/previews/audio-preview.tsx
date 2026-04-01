"use client";

import { FileAudio } from "lucide-react";
import { previewUrl } from "@/lib/file-preview";

interface AudioPreviewProps {
  filePath: string;
  fileName: string;
}

export function AudioPreview({ filePath, fileName }: AudioPreviewProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 size-full">
      <div className="flex size-20 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
        <FileAudio className="size-10 text-primary" />
      </div>
      <p className="text-sm font-mono text-muted-foreground truncate max-w-md">
        {fileName}
      </p>
      <audio
        src={previewUrl(filePath)}
        controls
        className="w-full max-w-md"
      />
    </div>
  );
}
