"use client";

import { useRef, useEffect, useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import type { FileEntry } from "@/lib/types";

interface PluginPreviewProps {
  pluginId: string;
  file: FileEntry;
}

interface PluginPreviewRegistration {
  render: (container: HTMLElement, file: FileEntry, api: PluginPreviewAPI) => void;
  destroy?: () => void;
}

interface PluginPreviewAPI {
  fetchFile: (path: string) => Promise<Response>;
  getFileUrl: (path: string) => string;
  theme: {
    isDark: boolean;
    colors: Record<string, string>;
  };
}

declare global {
  interface Window {
    __archiver_register_preview?: (
      pluginId: string,
      registration: PluginPreviewRegistration
    ) => void;
    __archiver_pending_previews?: Map<string, PluginPreviewRegistration>;
  }
}

function getThemeColors(): Record<string, string> {
  const style = getComputedStyle(document.documentElement);
  const props = [
    "background", "foreground", "card", "card-foreground",
    "primary", "primary-foreground", "muted", "muted-foreground",
    "accent", "accent-foreground", "border", "destructive",
  ];
  const colors: Record<string, string> = {};
  for (const prop of props) {
    colors[prop] = style.getPropertyValue(`--${prop}`).trim();
  }
  return colors;
}

export function PluginPreview({ pluginId, file }: PluginPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const registrationRef = useRef<PluginPreviewRegistration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scriptLoadedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;

    if (!window.__archiver_pending_previews) {
      window.__archiver_pending_previews = new Map();
    }

    window.__archiver_register_preview = (id, registration) => {
      window.__archiver_pending_previews!.set(id, registration);
    };

    const api: PluginPreviewAPI = {
      fetchFile: (filePath: string) =>
        fetch(`/api/files/download?path=${encodeURIComponent(filePath)}`),
      getFileUrl: (filePath: string) =>
        `/api/files/download?path=${encodeURIComponent(filePath)}`,
      theme: {
        isDark: document.documentElement.classList.contains("dark"),
        colors: getThemeColors(),
      },
    };

    // Check if already loaded (e.g., re-mount)
    const existing = window.__archiver_pending_previews.get(pluginId);
    if (existing && scriptLoadedRef.current) {
      registrationRef.current = existing;
      setLoading(false);
      existing.render(containerRef.current!, file, api);
      return;
    }

    // Load the script
    const script = document.createElement("script");
    script.src = `/api/plugins/view?pluginId=${encodeURIComponent(pluginId)}&type=preview&t=${Date.now()}`;
    script.async = true;

    script.onload = () => {
      scriptLoadedRef.current = true;
      const reg = window.__archiver_pending_previews?.get(pluginId);
      if (reg && containerRef.current) {
        registrationRef.current = reg;
        setLoading(false);
        reg.render(containerRef.current, file, api);
      } else {
        setError("Plugin preview failed to register");
        setLoading(false);
      }
    };

    script.onerror = () => {
      setError("Failed to load plugin preview bundle");
      setLoading(false);
    };

    document.head.appendChild(script);

    return () => {
      if (registrationRef.current?.destroy) {
        registrationRef.current.destroy();
      }
      registrationRef.current = null;
      window.__archiver_pending_previews?.delete(pluginId);
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [pluginId, file.path]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <AlertTriangle className="size-8 text-destructive" />
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
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
