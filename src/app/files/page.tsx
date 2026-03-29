"use client";

import { useState, useCallback, useEffect } from "react";
import { FolderOpen } from "lucide-react";
import { FileBrowser } from "@/components/files/file-browser";
import { Separator } from "@/components/ui/separator";

interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
}

export default function FilesPage() {
  const [currentPath, setCurrentPath] = useState("");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFiles = useCallback(async (filePath: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/files?path=${encodeURIComponent(filePath)}`
      );
      if (res.ok) {
        const data = await res.json();
        setFiles(data);
      } else {
        setFiles([]);
      }
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles(currentPath);
  }, [currentPath, fetchFiles]);

  function handleNavigate(path: string) {
    setCurrentPath(path);
  }

  function handleRefresh() {
    fetchFiles(currentPath);
  }

  return (
    <div className="flex flex-col gap-6 animate-vault-enter">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
          <FolderOpen className="size-4 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-heading font-bold uppercase tracking-wider">
            Files
          </h2>
          <p className="text-xs text-muted-foreground">
            Browse your archive
          </p>
        </div>
      </div>

      <Separator className="bg-border/50" />

      <FileBrowser
        files={files}
        currentPath={currentPath}
        loading={loading}
        onNavigate={handleNavigate}
        onRefresh={handleRefresh}
      />
    </div>
  );
}
