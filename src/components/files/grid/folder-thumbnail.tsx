import { Folder, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FolderPreview } from "@/hooks/use-folder-metadata";

export function FolderThumbnail({ preview }: { preview?: FolderPreview }) {
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
