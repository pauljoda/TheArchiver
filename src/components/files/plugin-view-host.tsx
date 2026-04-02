"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Loader2, AlertTriangle } from "lucide-react";

interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
}

interface PluginViewHostProps {
  pluginId: string;
  viewId: string;
  currentPath: string;
  trackedDirectory: string;
  onNavigate: (path: string) => void;
  onOpenFile: (path: string) => void;
}

interface PluginViewRegistration {
  render: (container: HTMLElement, api: PluginViewAPI) => void;
  destroy?: () => void;
  onPathChange?: (newPath: string, api: PluginViewAPI) => void;
}

interface PluginViewAPI {
  currentPath: string;
  trackedDirectory: string;
  navigate: (path: string) => void;
  openFile: (path: string) => void;
  fetchFiles: (path: string) => Promise<FileEntry[]>;
  fetchFile: (path: string) => Promise<Response>;
  theme: {
    isDark: boolean;
    colors: Record<string, string>;
  };
}

declare global {
  interface Window {
    __archiver_register_view?: (
      viewId: string,
      registration: PluginViewRegistration
    ) => void;
    __archiver_pending_views?: Map<string, PluginViewRegistration>;
  }
}

function getThemeColors(): Record<string, string> {
  const style = getComputedStyle(document.documentElement);
  const props = [
    "background",
    "foreground",
    "card",
    "card-foreground",
    "primary",
    "primary-foreground",
    "secondary",
    "secondary-foreground",
    "muted",
    "muted-foreground",
    "accent",
    "accent-foreground",
    "destructive",
    "destructive-foreground",
    "border",
    "input",
    "ring",
  ];
  const colors: Record<string, string> = {};
  for (const prop of props) {
    colors[prop] = style.getPropertyValue(`--${prop}`).trim();
  }
  return colors;
}

export function PluginViewHost({
  pluginId,
  viewId,
  currentPath,
  trackedDirectory,
  onNavigate,
  onOpenFile,
}: PluginViewHostProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const registrationRef = useRef<PluginViewRegistration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scriptLoadedRef = useRef(false);
  const currentPathRef = useRef(currentPath);
  currentPathRef.current = currentPath;

  const buildApi = useCallback(
    (path: string): PluginViewAPI => ({
      currentPath: path,
      trackedDirectory,
      navigate: onNavigate,
      openFile: onOpenFile,
      fetchFiles: async (filePath: string) => {
        const res = await fetch(
          `/api/files?path=${encodeURIComponent(filePath)}`
        );
        if (!res.ok) return [];
        return res.json();
      },
      fetchFile: (filePath: string) =>
        fetch(`/api/files/download?path=${encodeURIComponent(filePath)}`),
      theme: {
        isDark: document.documentElement.classList.contains("dark"),
        colors: getThemeColors(),
      },
    }),
    [trackedDirectory, onNavigate, onOpenFile]
  );

  // Load plugin script and render
  useEffect(() => {
    if (!containerRef.current) return;

    // Set up the registration callback
    if (!window.__archiver_pending_views) {
      window.__archiver_pending_views = new Map();
    }

    window.__archiver_register_view = (id, registration) => {
      window.__archiver_pending_views!.set(id, registration);
    };

    // If script already loaded (e.g., re-mount), check pending registrations
    const existing = window.__archiver_pending_views.get(viewId);
    if (existing && scriptLoadedRef.current) {
      registrationRef.current = existing;
      setLoading(false);
      existing.render(containerRef.current!, buildApi(currentPathRef.current));
      return;
    }

    // Load the script
    const script = document.createElement("script");
    script.src = `/api/plugins/view?pluginId=${encodeURIComponent(pluginId)}&t=${Date.now()}`;
    script.async = true;

    script.onload = () => {
      scriptLoadedRef.current = true;
      const reg = window.__archiver_pending_views?.get(viewId);
      if (reg && containerRef.current) {
        registrationRef.current = reg;
        setLoading(false);
        reg.render(containerRef.current, buildApi(currentPathRef.current));
      } else {
        setError("Plugin view failed to register");
        setLoading(false);
      }
    };

    script.onerror = () => {
      setError("Failed to load plugin view bundle");
      setLoading(false);
    };

    document.head.appendChild(script);

    return () => {
      if (registrationRef.current?.destroy) {
        registrationRef.current.destroy();
      }
      registrationRef.current = null;
      // Clean up script tag
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [pluginId, viewId]); // Only re-run on plugin change, not path change

  // Handle path changes without full re-render
  useEffect(() => {
    if (registrationRef.current?.onPathChange) {
      registrationRef.current.onPathChange(currentPath, buildApi(currentPath));
    }
  }, [currentPath, buildApi]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="size-5 text-destructive" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-destructive">{error}</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            The plugin view could not be loaded
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[calc(100vh-8rem)]">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ display: loading ? "none" : "block" }}
      />
    </div>
  );
}
