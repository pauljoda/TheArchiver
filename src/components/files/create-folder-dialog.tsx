"use client";

import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FolderPlus } from "lucide-react";
import { toast } from "sonner";

interface CreateFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPath: string;
  onCreated: () => void;
}

export function CreateFolderDialog({
  open,
  onOpenChange,
  currentPath,
  onCreated,
}: CreateFolderDialogProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setError("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  function validate(value: string): string | null {
    if (!value.trim()) return "Folder name is required";
    if (value.includes("/") || value.includes("\\"))
      return "Name cannot contain path separators";
    if (value === "." || value === "..") return "Invalid folder name";
    return null;
  }

  async function handleSubmit() {
    const err = validate(name);
    if (err) {
      setError(err);
      return;
    }

    setLoading(true);
    setError("");

    const targetPath = currentPath ? `${currentPath}/${name}` : name;

    try {
      const res = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mkdir", path: targetPath }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (res.status === 409) {
          setError("A folder with this name already exists");
        } else {
          setError(data.error || "Failed to create folder");
        }
        return;
      }

      toast.success(`Created folder "${name}"`);
      onOpenChange(false);
      onCreated();
    } catch {
      setError("Failed to create folder");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading text-sm uppercase tracking-wider">
            <FolderPlus className="size-4" />
            New Folder
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="folder-name" className="text-xs text-muted-foreground">
            Folder name
          </Label>
          <Input
            ref={inputRef}
            id="folder-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !loading) handleSubmit();
            }}
            placeholder="New folder"
            className="font-mono text-sm"
          />
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
