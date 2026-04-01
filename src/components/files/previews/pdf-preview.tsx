"use client";

import { FileText } from "lucide-react";
import { previewUrl } from "@/lib/file-preview";

interface PdfPreviewProps {
  filePath: string;
}

export function PdfPreview({ filePath }: PdfPreviewProps) {
  return (
    <div className="flex flex-col size-full">
      <iframe
        src={previewUrl(filePath)}
        className="flex-1 w-full rounded-lg border border-border/50 bg-white"
        title="PDF preview"
      />
      <noscript>
        <div className="flex flex-col items-center justify-center gap-4 size-full">
          <FileText className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            PDF preview is not available in your browser
          </p>
        </div>
      </noscript>
    </div>
  );
}
