"use client";

import type { FileEntry } from "@/lib/types";
import { FileCard } from "./grid/file-card";

interface FileGridViewProps {
  files: FileEntry[];
  currentPath: string;
  selectedPaths: Set<string>;
  hasSelection: boolean;
  onToggleSelect: (path: string, index: number, shiftKey: boolean) => void;
  onNavigate: (path: string) => void;
  onFileOpen?: (file: FileEntry) => void;
  onRename: (file: FileEntry) => void;
  onMoveCopy: (paths: string[], action: "move" | "copy") => void;
  onDelete: (path: string) => void;
}

export function FileGridView({
  files,
  currentPath,
  selectedPaths,
  hasSelection,
  onToggleSelect,
  onNavigate,
  onFileOpen,
  onRename,
  onMoveCopy,
  onDelete,
}: FileGridViewProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 p-4">
      {files.map((file, i) => (
        <FileCard
          key={file.path}
          file={file}
          index={i}
          isSelected={selectedPaths.has(file.path)}
          hasSelection={hasSelection}
          onToggleSelect={onToggleSelect}
          onClick={
            file.isDirectory
              ? () => onNavigate(file.path)
              : () => onFileOpen?.(file)
          }
          onRename={onRename}
          onMoveCopy={onMoveCopy}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
