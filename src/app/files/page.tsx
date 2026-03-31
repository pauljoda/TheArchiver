"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { FolderOpen } from "lucide-react";
import { FileBrowser } from "@/components/files/file-browser";
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

export default function FilesPage() {
  const [currentPath, setCurrentPath] = useState("");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewProviders, setViewProviders] = useState<ViewProviderInfo[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
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

  useEffect(() => {
    fetchFiles(currentPath);
    fetchViewProviders(currentPath).then((providers) => {
      if (providers.length > 0 && !userExplicitlyChoseFiles.current) {
        setActiveViewId(providers[0].viewId);
      } else if (providers.length === 0) {
        setActiveViewId(null);
        userExplicitlyChoseFiles.current = false;
      }
    });
  }, [currentPath, fetchFiles, fetchViewProviders]);

  function handleNavigate(path: string) {
    setCurrentPath(path);
  }

  function handleRefresh() {
    fetchFiles(currentPath);
  }

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
        <div className="w-full px-4 sm:px-6 lg:px-8 pb-8">
          <PluginViewHost
            pluginId={activeProvider.pluginId}
            viewId={activeProvider.viewId}
            currentPath={currentPath}
            trackedDirectory={currentPath.split("/")[0] || currentPath}
            onNavigate={handleNavigate}
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
          />
        </div>
      )}
    </div>
  );
}
