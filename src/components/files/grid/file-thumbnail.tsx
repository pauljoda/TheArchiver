import { File, FileVideo } from "lucide-react";
import { FILE_ICONS, getFileIconType } from "@/lib/file-icons";
import type { FileEntry } from "@/lib/types";

function isImageFile(name: string): boolean {
  return /\.(jpe?g|png|gif|webp|avif|svg|bmp|ico)$/i.test(name);
}

function isVideoFile(name: string): boolean {
  return /\.(mp4|m4v|mkv|avi|mov|webm|flv|wmv)$/i.test(name);
}

export function FileThumbnail({ file }: { file: FileEntry }) {
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

  if (isVideoFile(file.name)) {
    return (
      <div className="relative size-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/files/thumbnail?path=${encodeURIComponent(file.path)}`}
          alt=""
          className="size-full object-cover"
          loading="lazy"
          onError={(e) => {
            // Fallback to icon if thumbnail generation fails
            const target = e.currentTarget;
            target.style.display = "none";
            target.parentElement!.classList.add(
              "flex", "flex-col", "items-center", "justify-center", "gap-1"
            );
            target.parentElement!.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground/40"><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>
              <span class="text-[10px] font-mono text-muted-foreground/40 uppercase">Video</span>
            `;
          }}
        />
        <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5">
          <FileVideo className="size-3 text-white/80" />
        </div>
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
