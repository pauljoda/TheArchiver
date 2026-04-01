"use client";

import { useState } from "react";
import { Download, FileVideo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { previewUrl, NATIVE_VIDEO_EXTS } from "@/lib/file-preview";

interface VideoPreviewProps {
  filePath: string;
  fileName: string;
}

export function VideoPreview({ filePath, fileName }: VideoPreviewProps) {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const isNative = NATIVE_VIDEO_EXTS.has(ext);
  const [error, setError] = useState(false);

  if (!isNative || error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 size-full text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
          <FileVideo className="size-8 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {error ? "Unable to play this video" : `Format .${ext} is not supported for browser playback`}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Download the file to play it locally
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

  return (
    <div className="flex items-center justify-center size-full">
      <video
        src={previewUrl(filePath)}
        controls
        className="max-h-full max-w-full"
        onError={() => setError(true)}
      />
    </div>
  );
}
