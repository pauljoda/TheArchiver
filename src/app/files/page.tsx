"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { FolderOpen } from "lucide-react";
import { FileBrowser } from "@/components/files/file-browser";
import { FileDetailView } from "@/components/files/file-detail-view";
import { PluginViewHost } from "@/components/files/plugin-view-host";
import {
  ViewToggle,
  type ViewProviderInfo,
} from "@/components/files/view-toggle";
import { FileBreadcrumb } from "@/components/files/file-breadcrumb";
import { Separator } from "@/components/ui/separator";

interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
}

function getPathFromUrl(): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return params.get("path") || "";
}

function getFileFromUrl(): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return params.get("file") || "";
}

export default function FilesPage() {
  const [currentPath, setCurrentPath] = useState("");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewProviders, setViewProviders] = useState<ViewProviderInfo[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<FileEntry | null>(null);
  const [mounted, setMounted] = useState(false);
  // Track whether user explicitly chose "Files" view so we don't auto-switch
  const userExplicitlyChoseFiles = useRef(false);

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

  const fetchViewProviders = useCallback(async (filePath: string) => {
    try {
      const res = await fetch(
        `/api/files/view-providers?path=${encodeURIComponent(filePath)}`
      );
      if (res.ok) {
        const data: ViewProviderInfo[] = await res.json();
        setViewProviders(data);
        return data;
      }
    } catch {
      // ignore
    }
    setViewProviders([]);
    return [];
  }, []);

  // Sync state from URL on mount and listen for browser back/forward
  useEffect(() => {
    const initialPath = getPathFromUrl();
    const initialFile = getFileFromUrl();

    // Set initial state from URL
    setCurrentPath(initialPath);
    setMounted(true);

    // Replace current entry so the initial load has state
    const params = new URLSearchParams();
    if (initialPath) params.set("path", initialPath);
    if (initialFile) params.set("file", initialFile);
    const url = params.toString() ? `/files?${params}` : "/files";
    window.history.replaceState({ path: initialPath, file: initialFile }, "", url);

    function onPopState() {
      // Browser handled the history entry — just sync React state
      setCurrentPath(getPathFromUrl());
      const filePath = getFileFromUrl();
      if (!filePath) {
        setPreviewFile(null);
      }
      // If filePath is set, we resolve it once files are loaded (see effect below)
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    fetchFiles(currentPath);
    fetchViewProviders(currentPath).then((providers) => {
      if (providers.length > 0 && !userExplicitlyChoseFiles.current) {
        setActiveViewId(providers[0].viewId);
      } else if (providers.length === 0) {
        setActiveViewId(null);
        userExplicitlyChoseFiles.current = false;
      }
    });
  }, [mounted, currentPath, fetchFiles, fetchViewProviders]);

  const handleNavigate = useCallback((path: string) => {
    // Push to browser history so back/forward works
    const url = path ? `/files?path=${encodeURIComponent(path)}` : "/files";
    window.history.pushState({ path }, "", url);
    setCurrentPath(path);
  }, []);

  function handleRefresh() {
    fetchFiles(currentPath);
  }

  // Resolve file URL param into previewFile once files are loaded
  useEffect(() => {
    const filePath = getFileFromUrl();
    if (filePath && files.length > 0 && !previewFile) {
      const match = files.find((f) => f.path === filePath);
      if (match && !match.isDirectory) {
        setPreviewFile(match);
      }
    }
  }, [files, previewFile]);

  function buildUrl(path: string, file?: string) {
    const params = new URLSearchParams();
    if (path) params.set("path", path);
    if (file) params.set("file", file);
    return params.toString() ? `/files?${params}` : "/files";
  }

  const handleFileOpen = useCallback(
    (file: FileEntry) => {
      setPreviewFile(file);
      const url = buildUrl(currentPath, file.path);
      window.history.pushState({ path: currentPath, file: file.path }, "", url);
    },
    [currentPath]
  );

  const handlePluginFileOpen = useCallback(
    async (filePath: string) => {
      let match = files.find((f) => f.path === filePath && !f.isDirectory);

      if (!match) {
        const parentPath = filePath.split("/").slice(0, -1).join("/");
        try {
          const res = await fetch(
            `/api/files?path=${encodeURIComponent(parentPath)}`
          );
          if (res.ok) {
            const data: FileEntry[] = await res.json();
            if (parentPath === currentPath) {
              setFiles(data);
            }
            match = data.find((f) => f.path === filePath && !f.isDirectory);
          }
        } catch {
          match = undefined;
        }
      }

      if (!match) return;

      setPreviewFile(match);
      const url = buildUrl(currentPath, match.path);
      window.history.pushState({ path: currentPath, file: match.path }, "", url);
    },
    [files, currentPath]
  );

  const handleFileChange = useCallback(
    (file: FileEntry) => {
      setPreviewFile(file);
      const url = buildUrl(currentPath, file.path);
      window.history.replaceState({ path: currentPath, file: file.path }, "", url);
    },
    [currentPath]
  );

  const handlePreviewClose = useCallback(() => {
    setPreviewFile(null);
    const url = buildUrl(currentPath);
    window.history.pushState({ path: currentPath }, "", url);
  }, [currentPath]);

  function handleViewSelect(viewId: string | null) {
    setActiveViewId(viewId);
    if (viewId === null) {
      userExplicitlyChoseFiles.current = true;
    } else {
      userExplicitlyChoseFiles.current = false;
    }
  }

  const isPluginView = activeViewId !== null;
  const activeProvider = viewProviders.find(
    (p) => p.viewId === activeViewId
  );

  return (
    <div className="flex flex-col animate-vault-enter">
      {/* Top bar: page header + view toggle */}
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pt-8 pb-6">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
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

            {viewProviders.length > 0 && (
              <ViewToggle
                providers={viewProviders}
                activeViewId={activeViewId}
                onSelect={handleViewSelect}
              />
            )}
          </div>

          <Separator className="bg-border/50" />

          {/* Breadcrumb shown for plugin views */}
          {isPluginView && (
            <FileBreadcrumb
              currentPath={currentPath}
              onNavigate={handleNavigate}
            />
          )}
        </div>
      </div>

      {/* Content area */}
      {isPluginView && activeProvider ? (
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pb-8">
          <PluginViewHost
            pluginId={activeProvider.pluginId}
            viewId={activeProvider.viewId}
            currentPath={currentPath}
            trackedDirectory={activeProvider.trackedDirectory}
            onNavigate={handleNavigate}
            onOpenFile={handlePluginFileOpen}
          />
        </div>
      ) : (
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pb-8">
          <FileBrowser
            files={files}
            currentPath={currentPath}
            loading={loading}
            onNavigate={handleNavigate}
            onRefresh={handleRefresh}
            onFileOpen={handleFileOpen}
          />
        </div>
      )}

      {/* File detail overlay */}
      {previewFile && (
        <FileDetailView
          file={previewFile}
          files={files}
          onClose={handlePreviewClose}
          onFileChange={handleFileChange}
          onRefresh={handleRefresh}
        />
      )}
    </div>
  );
}
