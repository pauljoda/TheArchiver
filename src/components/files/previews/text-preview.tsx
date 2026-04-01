"use client";

import { useEffect, useState, useMemo } from "react";
import { AlertTriangle, WrapText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { previewUrl } from "@/lib/file-preview";
import { formatFileSize } from "@/lib/utils";

interface TextPreviewProps {
  filePath: string;
  fileName: string;
  fileSize: number;
}

const MAX_BYTES = 512_000; // 500 KB

const FORMATTABLE_EXTS = new Set(["json"]);

function tryFormat(text: string, ext: string): string | null {
  if (ext === "json") {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return null;
    }
  }
  return null;
}

export function TextPreview({ filePath, fileName, fileSize }: TextPreviewProps) {
  const [content, setContent] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prettyPrint, setPrettyPrint] = useState(false);

  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const canFormat = FORMATTABLE_EXTS.has(ext);

  useEffect(() => {
    let cancelled = false;
    setContent(null);
    setError(null);
    setTruncated(false);
    setPrettyPrint(false);

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

  const displayContent = useMemo(() => {
    if (!content) return null;
    if (prettyPrint) {
      return tryFormat(content, ext) ?? content;
    }
    return content;
  }, [content, prettyPrint, ext]);

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

  const lines = (displayContent ?? "").split("\n");

  return (
    <div className="flex flex-col size-full overflow-hidden">
      {(truncated || canFormat) && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 shrink-0">
          {truncated && (
            <div className="flex items-center gap-2 text-primary text-xs bg-primary/10 px-2 py-1 rounded">
              <AlertTriangle className="size-3.5" />
              Showing first {formatFileSize(MAX_BYTES)} of {formatFileSize(fileSize)}
            </div>
          )}
          <div className="flex-1" />
          {canFormat && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={prettyPrint ? "secondary" : "ghost"}
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-foreground"
                  onClick={() => setPrettyPrint((p) => !p)}
                >
                  <WrapText className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{prettyPrint ? "Show raw" : "Pretty print"}</TooltipContent>
            </Tooltip>
          )}
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
