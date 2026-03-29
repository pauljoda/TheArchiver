"use client";

import { useState } from "react";
import { Plus, Globe, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";

interface AddUrlDialogProps {
  onAdded: () => void;
}

export function AddUrlDialog({ onAdded }: AddUrlDialogProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add URL");
      }

      setUrl("");
      setOpen(false);
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 font-heading text-xs uppercase tracking-wider">
          <Plus className="size-3.5" />
          Add URL
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading text-base uppercase tracking-wider">
            <Globe className="size-4 text-primary" />
            Add to Archive
          </DialogTitle>
          <DialogDescription className="text-xs">
            Enter a URL to queue for download. A matching plugin will process it
            automatically.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="relative">
            <Input
              placeholder="https://example.com/content"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              type="url"
              required
              className="pr-10 font-mono text-sm"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <ArrowRight className="size-3.5 text-muted-foreground/40" />
            </div>
          </div>
          {error && (
            <p className="text-xs text-destructive font-medium">{error}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading} className="font-heading text-xs uppercase tracking-wider">
              {loading ? "Queuing..." : "Archive"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
