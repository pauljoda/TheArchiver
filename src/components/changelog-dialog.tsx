"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

function parseChangelog(raw: string): string {
  return raw
    // Headings
    .replace(/^### (.+)$/gm, '<h3 class="text-xs font-heading font-bold uppercase tracking-wider text-primary mt-4 mb-2">$1</h3>')
    .replace(/^## \[Unreleased\]$/gm, '<h2 class="text-sm font-heading font-bold uppercase tracking-wider text-primary/80 mt-6 mb-3 border-b border-border/50 pb-2">Unreleased</h2>')
    .replace(/^## \[(.+?)\](?: - (.+))?$/gm, (_m, ver, date) => {
      const dateStr = date ? `<span class="text-muted-foreground/60 font-mono text-[10px] ml-2">${date}</span>` : "";
      return `<h2 class="text-sm font-heading font-bold uppercase tracking-wider text-foreground mt-6 mb-3 border-b border-border/50 pb-2">${ver}${dateStr}</h2>`;
    })
    .replace(/^# (.+)$/gm, '')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground">$1</strong>')
    // Links
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-primary hover:underline">$1</a>')
    // List items
    .replace(/^- (.+)$/gm, '<li class="text-xs text-muted-foreground leading-relaxed pl-1 break-words">$1</li>')
    .replace(/^  - (.+)$/gm, '<li class="text-xs text-muted-foreground/70 leading-relaxed pl-5 break-words">$1</li>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="text-[10px] font-mono bg-muted/50 px-1 py-0.5 rounded break-all">$1</code>')
    // Wrap adjacent li elements in ul
    .replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, '<ul class="list-disc list-outside ml-4 space-y-1 mb-2">$1</ul>')
    // Empty lines
    .replace(/^\s*$/gm, '');
}

export function ChangelogDialog({
  version,
  children,
}: {
  version: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || content) return;
    setLoading(true);
    fetch("/api/changelog")
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((text) => setContent(text))
      .catch(() => setContent("Failed to load changelog."))
      .finally(() => setLoading(false));
  }, [open, content]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-3xl h-[85vh] sm:h-[80vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="font-heading text-sm uppercase tracking-wider">
            Changelog &middot; v{version}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 min-h-0">
          <div className="pr-4">
            {loading ? (
              <p className="text-xs text-muted-foreground animate-pulse">
                Loading changelog...
              </p>
            ) : content ? (
              <div
                className="prose-changelog pb-4 overflow-hidden break-words"
                dangerouslySetInnerHTML={{ __html: parseChangelog(content) }}
              />
            ) : null}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
