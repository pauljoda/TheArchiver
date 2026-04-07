import { Heart, MessageCircle, ArrowUp } from "lucide-react";
import type { PostCardMetadata } from "@/hooks/use-folder-metadata";

const PLATFORM_ICONS: Record<string, string> = {
  reddit: "Reddit",
  bluesky: "Bluesky",
  twitter: "X",
};

function formatScore(n: number): string {
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + "k";
  return n.toString();
}

export function SocialMeta({ meta }: { meta: PostCardMetadata }) {
  const platformLabel = PLATFORM_ICONS[meta.platform] || meta.platform;
  const authorPrefix = meta.platform === "reddit" ? "u/" : "@";

  return (
    <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground/60 mt-1 flex-wrap">
      <span className="text-primary/60">{platformLabel}</span>
      <span>
        {authorPrefix}
        {meta.author}
      </span>
      {meta.score !== undefined && (
        <span className="flex items-center gap-0.5">
          {meta.platform === "reddit" ? (
            <ArrowUp className="size-3" />
          ) : (
            <Heart className="size-3" />
          )}
          {formatScore(meta.score)}
        </span>
      )}
      {meta.commentCount !== undefined && (
        <span className="flex items-center gap-0.5">
          <MessageCircle className="size-3" />
          {formatScore(meta.commentCount)}
        </span>
      )}
    </div>
  );
}
