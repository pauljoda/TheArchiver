"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { previewUrl } from "@/lib/file-preview";
import { formatFileSize } from "@/lib/utils";

interface TextPreviewProps {
  filePath: string;
  fileSize: number;
}

const MAX_BYTES = 512_000; // 500 KB

export function TextPreview({ filePath, fileSize }: TextPreviewProps) {
  const [content, setContent] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setContent(null);
    setError(null);
    setTruncated(false);

    fetch(previewUrl(filePath, MAX_BYTES))
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load file");
        if (res.headers.get("X-Truncated") === "true") {
          setTruncated(true);
        }
        return res.text();
      })
      .then((text) => {
        if (!cancelled) setContent(text);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => { cancelled = true; };
  }, [filePath]);

  if (error) {
    return (
      <div className="flex items-center justify-center size-full">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (content === null) {
    return (
      <div className="flex items-center justify-center size-full">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const lines = content.split("\n");

  return (
    <div className="flex flex-col size-full overflow-hidden">
      {truncated && (
        <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary text-xs border-b border-border/50 shrink-0">
          <AlertTriangle className="size-3.5" />
          Showing first {formatFileSize(MAX_BYTES)} of {formatFileSize(fileSize)}
        </div>
      )}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="hover:bg-muted/20">
                <td className="sticky left-0 bg-muted/30 px-3 py-0 text-right text-[11px] font-mono text-muted-foreground/40 select-none w-12 shrink-0 align-top">
                  {i + 1}
                </td>
                <td className="px-4 py-0 text-sm font-mono whitespace-pre text-foreground/80">
                  {line}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
