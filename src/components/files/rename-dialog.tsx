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
import { Pencil } from "lucide-react";
import { toast } from "sonner";

interface RenameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filePath: string;
  fileName: string;
  onRenamed: () => void;
}

export function RenameDialog({
  open,
  onOpenChange,
  filePath,
  fileName,
  onRenamed,
}: RenameDialogProps) {
  const [name, setName] = useState(fileName);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(fileName);
      setError("");
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [open, fileName]);

  function validate(value: string): string | null {
    if (!value.trim()) return "Name is required";
    if (value.includes("/") || value.includes("\\"))
      return "Name cannot contain path separators";
    if (value === "." || value === "..") return "Invalid name";
    if (value === fileName) return "Name is unchanged";
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

    try {
      const res = await fetch("/api/files", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rename",
          path: filePath,
          newName: name,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (res.status === 409) {
          setError("An item with this name already exists");
        } else {
          setError(data.error || "Failed to rename");
        }
        return;
      }

      toast.success(`Renamed to "${name}"`);
      onOpenChange(false);
      onRenamed();
    } catch {
      setError("Failed to rename");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading text-sm uppercase tracking-wider">
            <Pencil className="size-4" />
            Rename
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="rename-input" className="text-xs text-muted-foreground">
            New name
          </Label>
          <Input
            ref={inputRef}
            id="rename-input"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !loading) handleSubmit();
            }}
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
            {loading ? "Renaming..." : "Rename"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
