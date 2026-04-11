"use client";

import { useState, useCallback, useEffect } from "react";
import { FileBrowser } from "@/components/files/file-browser";
import { FileDetailView } from "@/components/files/file-detail-view";
import { PluginViewHost } from "@/components/files/plugin-view-host";
import {
  ViewToggle,
  type ViewProviderInfo,
} from "@/components/files/view-toggle";
import { FileBreadcrumb } from "@/components/files/file-breadcrumb";
import type { FileEntry } from "@/lib/types";

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
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [activeViewRestored, setActiveViewRestored] = useState(false);
  const [userExplicitlySelectedFiles, setUserExplicitlySelectedFiles] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileEntry | null>(null);
  const [mounted, setMounted] = useState(false);


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

  // Restore active view preference from cookie on mount
  useEffect(() => {
    if (!mounted) return;
    const match = document.cookie.match(/(?:^|;\s*)archiver-active-view=([^;]+)/);
    if (match?.[1]) {
      const stored = decodeURIComponent(match[1]);
      if (stored === "files") {
        setUserExplicitlySelectedFiles(true);
      } else {
        // Will be applied once view providers load
        setActiveProviderId(stored);
      }
    }
    setActiveViewRestored(true);
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    fetchFiles(currentPath).then(() => {
      // After files load, check if this is a post directory (contains Post.nfo)
      // If so, auto-activate plugin view for the detail renderer
    });
    fetchViewProviders(currentPath).then((providers) => {
      if (providers.length === 0) {
        setActiveProviderId(null);
      } else if (!userExplicitlySelectedFiles) {
        // Restore stored view preference if available, otherwise use first provider.
        // Accept both the composite id (pluginId:viewId) and the legacy bare viewId.
        const match = document.cookie.match(/(?:^|;\s*)archiver-active-view=([^;]+)/);
        const stored = match?.[1] ? decodeURIComponent(match[1]) : null;
        const restored =
          stored && stored !== "files"
            ? providers.find((p) => p.id === stored || p.viewId === stored)?.id
            : null;
        if (restored) {
          setActiveProviderId(restored);
        } else if (stored !== "files") {
          setActiveProviderId(providers[0].id);
        }
      }
    });
  }, [mounted, currentPath, fetchFiles, fetchViewProviders, userExplicitlySelectedFiles]);

  // Auto-activate plugin view when entering a post directory (has Post.nfo)
  useEffect(() => {
    if (!mounted || !activeViewRestored || files.length === 0) return;
    const hasPostNfo = files.some((f) => !f.isDirectory && f.name === "Post.nfo");
    if (hasPostNfo && viewProviders.length > 0 && activeProviderId === null && !userExplicitlySelectedFiles) {
      setActiveProviderId(viewProviders[0].id);
    }
  }, [mounted, activeViewRestored, files, viewProviders, activeProviderId, userExplicitlySelectedFiles]);

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

  function handleViewSelect(providerId: string | null) {
    setActiveProviderId(providerId);
    // Track when user explicitly selects Files view to prevent auto-reactivation
    setUserExplicitlySelectedFiles(providerId === null);
    // Persist preference globally
    const value = providerId ?? "files";
    document.cookie = `archiver-active-view=${encodeURIComponent(value)};path=/;max-age=${365 * 24 * 60 * 60};samesite=lax`;
  }

  const isPluginView = activeProviderId !== null;
  const activeProvider = viewProviders.find((p) => p.id === activeProviderId);

  return (
    <div className="flex flex-col animate-vault-enter">
      {/* Top bar: view toggle + breadcrumb (when plugin views available) */}
      {(viewProviders.length > 0 || isPluginView) && (
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 pb-4">
          <div className="flex flex-col gap-4">
            {viewProviders.length > 0 && (
              <div className="flex w-full min-w-0 justify-start sm:justify-end">
                <div className="min-w-0 max-w-full">
                  <ViewToggle
                    providers={viewProviders}
                    activeProviderId={activeProviderId}
                    onSelect={handleViewSelect}
                  />
                </div>
              </div>
            )}

            {/* Breadcrumb shown for plugin views */}
            {isPluginView && (
              <FileBreadcrumb
                currentPath={currentPath}
                onNavigate={handleNavigate}
              />
            )}
          </div>
        </div>
      )}

      {/* Content area */}
      {isPluginView && activeProvider ? (
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pb-8 pt-2">
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
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 pb-8">
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
