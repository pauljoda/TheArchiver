"use client";

import { useState } from "react";
import { previewUrl } from "@/lib/file-preview";

interface ImagePreviewProps {
  filePath: string;
}

export function ImagePreview({ filePath }: ImagePreviewProps) {
  const [zoomed, setZoomed] = useState(false);

  return (
    <div
      className={
        "flex items-center justify-center size-full overflow-auto " +
        (zoomed ? "cursor-zoom-out" : "cursor-zoom-in")
      }
      onClick={() => setZoomed((z) => !z)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={previewUrl(filePath)}
        alt=""
        className={
          zoomed
            ? "max-w-none"
            : "max-h-full max-w-full object-contain"
        }
        draggable={false}
      />
    </div>
  );
}
