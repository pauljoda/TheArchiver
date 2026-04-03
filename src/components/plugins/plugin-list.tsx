"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Puzzle,
  Settings,
  Trash2,
  Power,
  User,
  RefreshCw,
  Upload,
  ChevronDown,
  GripVertical,
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PluginImportDialog } from "./plugin-import-dialog";
import { cn } from "@/lib/utils";

interface PluginInfo {
  id: string;
  name: string;
  version?: string;
  description?: string;
  author?: string;
  urlPatterns: string[];
  enabled: boolean;
  hasSettings: boolean;
}

interface PluginListProps {
  plugins: PluginInfo[];
  onRefresh?: () => void;
}

const URL_PATTERN_LIMIT = 3;

/* ── Plugin row content (shared by sortable row + drag overlay) ── */

interface PluginRowContentProps {
  plugin: PluginInfo;
  expandedUrls: Set<string>;
  onToggleUrls?: (id: string) => void;
  togglingId: string | null;
  onToggle?: (id: string, enabled: boolean) => void;
  updatingId: string | null;
  onStartUpdate?: (id: string) => void;
  confirmRemove: string | null;
  onConfirmRemove?: (id: string | null) => void;
  removingId: string | null;
  onRemove?: (id: string, deleteSettings: boolean) => void;
  dragHandleProps?: Record<string, unknown>;
  isOverlay?: boolean;
}

function PluginRowContent({
  plugin,
  expandedUrls,
  onToggleUrls,
  togglingId,
  onToggle,
  updatingId,
  onStartUpdate,
  confirmRemove,
  onConfirmRemove,
  removingId,
  onRemove,
  dragHandleProps,
  isOverlay,
}: PluginRowContentProps) {
  return (
    <>
      {/* Drag handle */}
      <button
        type="button"
        className={cn(
          "flex shrink-0 items-center justify-center mt-1.5 touch-none",
          isOverlay
            ? "cursor-grabbing text-primary"
            : "cursor-grab text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing"
        )}
        {...dragHandleProps}
      >
        <GripVertical className="size-4" />
      </button>

      {/* Plugin icon */}
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
          plugin.enabled
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground"
        )}
      >
        <Puzzle className="size-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{plugin.name}</span>
          {plugin.version && (
            <Badge variant="outline" className="text-[10px] font-mono">
              v{plugin.version}
            </Badge>
          )}
          {!plugin.enabled && (
            <Badge
              variant="secondary"
              className="text-[10px] font-heading uppercase tracking-wider"
            >
              <Power className="size-2.5 mr-0.5" />
              Off
            </Badge>
          )}
        </div>
        {plugin.description && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {plugin.description}
          </p>
        )}
        {plugin.author && (
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground/60 mt-0.5">
            <User className="size-2.5" />
            {plugin.author}
          </p>
        )}
        {plugin.urlPatterns.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mt-2">
            {(expandedUrls.has(plugin.id)
              ? plugin.urlPatterns
              : plugin.urlPatterns.slice(0, URL_PATTERN_LIMIT)
            ).map((pattern) => (
              <Badge
                key={pattern}
                variant="secondary"
                className="text-[10px] font-mono"
              >
                {pattern}
              </Badge>
            ))}
            {plugin.urlPatterns.length > URL_PATTERN_LIMIT && (
              <button
                type="button"
                className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded-md hover:bg-muted"
                onClick={() => onToggleUrls?.(plugin.id)}
              >
                <span>
                  {expandedUrls.has(plugin.id)
                    ? "less"
                    : `+${plugin.urlPatterns.length - URL_PATTERN_LIMIT} more`}
                </span>
                <ChevronDown
                  className={cn(
                    "size-3 transition-transform",
                    expandedUrls.has(plugin.id) && "rotate-180"
                  )}
                />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Switch
          checked={plugin.enabled}
          disabled={togglingId === plugin.id || isOverlay}
          onCheckedChange={(checked) => onToggle?.(plugin.id, checked)}
        />
        {plugin.hasSettings && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
                asChild
              >
                <Link href={`/settings?group=plugin:${plugin.name}`}>
                  <Settings className="size-3.5" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Settings</TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
              disabled={updatingId !== null || isOverlay}
              onClick={() => onStartUpdate?.(plugin.id)}
            >
              <Upload
                className={cn(
                  "size-3.5",
                  updatingId === plugin.id && "animate-pulse"
                )}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Update</TooltipContent>
        </Tooltip>
        {confirmRemove === plugin.id ? (
          <div className="flex items-center gap-1 animate-slide-in">
            <Button
              variant="destructive"
              size="sm"
              className="h-7 text-[10px] font-heading uppercase tracking-wider"
              disabled={removingId === plugin.id}
              onClick={() => onRemove?.(plugin.id, false)}
            >
              {removingId === plugin.id ? "..." : "Remove"}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-7 text-[10px] font-heading uppercase tracking-wider bg-destructive/80"
              disabled={removingId === plugin.id}
              onClick={() => onRemove?.(plugin.id, true)}
            >
              {removingId === plugin.id ? "..." : "Purge Settings"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[10px]"
              onClick={() => onConfirmRemove?.(null)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={() => onConfirmRemove?.(plugin.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Remove</TooltipContent>
          </Tooltip>
        )}
      </div>
    </>
  );
}

/* ── Sortable plugin row ── */

interface SortablePluginRowProps {
  plugin: PluginInfo;
  index: number;
  isDragActive: boolean;
  expandedUrls: Set<string>;
  onToggleUrls: (id: string) => void;
  togglingId: string | null;
  onToggle: (id: string, enabled: boolean) => void;
  updatingId: string | null;
  onStartUpdate: (id: string) => void;
  confirmRemove: string | null;
  onConfirmRemove: (id: string | null) => void;
  removingId: string | null;
  onRemove: (id: string, deleteSettings: boolean) => void;
}

function SortablePluginRow({
  plugin,
  index,
  isDragActive,
  expandedUrls,
  onToggleUrls,
  togglingId,
  onToggle,
  updatingId,
  onStartUpdate,
  confirmRemove,
  onConfirmRemove,
  removingId,
  onRemove,
}: SortablePluginRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: plugin.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    animationDelay: `${index * 40}ms`,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-start gap-3 px-5 py-4 transition-colors animate-vault-enter",
        !plugin.enabled && "opacity-50",
        isDragging
          ? "relative z-10 bg-primary/5 border border-dashed border-primary/30 rounded-lg opacity-40"
          : "hover:bg-muted/30",
        isDragActive && !isDragging && "transition-transform duration-200"
      )}
    >
      <PluginRowContent
        plugin={plugin}
        expandedUrls={expandedUrls}
        onToggleUrls={onToggleUrls}
        togglingId={togglingId}
        onToggle={onToggle}
        updatingId={updatingId}
        onStartUpdate={onStartUpdate}
        confirmRemove={confirmRemove}
        onConfirmRemove={onConfirmRemove}
        removingId={removingId}
        onRemove={onRemove}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

/* ── Plugin list ── */

export function PluginList({ plugins, onRefresh }: PluginListProps) {
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);
  const [expandedUrls, setExpandedUrls] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const updateFileRef = useRef<HTMLInputElement>(null);

  const activePlugin = activeId ? plugins.find((p) => p.id === activeId) : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleToggleUrls = useCallback((id: string) => {
    setExpandedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  async function handleReload() {
    setReloading(true);
    try {
      await fetch("/api/plugins/reload", { method: "POST" });
      onRefresh?.();
    } catch (err) {
      console.error("Failed to reload plugins:", err);
    } finally {
      setReloading(false);
    }
  }

  async function handleToggle(id: string, enabled: boolean) {
    setTogglingId(id);
    try {
      await fetch(`/api/plugins/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      onRefresh?.();
    } catch (err) {
      console.error("Failed to toggle plugin:", err);
    } finally {
      setTogglingId(null);
    }
  }

  async function handleRemove(id: string, deleteSettings = false) {
    setRemovingId(id);
    try {
      const url = deleteSettings
        ? `/api/plugins/${id}?deleteSettings=true`
        : `/api/plugins/${id}`;
      await fetch(url, { method: "DELETE" });
      setConfirmRemove(null);
      onRefresh?.();
    } catch (err) {
      console.error("Failed to remove plugin:", err);
    } finally {
      setRemovingId(null);
    }
  }

  async function handleUpdate(file: File) {
    if (!file.name.endsWith(".zip")) return;
    setUpdatingId("pending");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/plugins/install", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        console.error("Failed to update plugin:", data.error);
      }
      onRefresh?.();
    } catch (err) {
      console.error("Failed to update plugin:", err);
    } finally {
      setUpdatingId(null);
      if (updateFileRef.current) updateFileRef.current.value = "";
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = plugins.findIndex((p) => p.id === active.id);
    const newIndex = plugins.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    // Build new ordered ID list
    const ids = plugins.map((p) => p.id);
    ids.splice(oldIndex, 1);
    ids.splice(newIndex, 0, active.id as string);

    // Persist to server, then refresh to get updated order
    try {
      await fetch("/api/plugins/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: ids }),
      });
      onRefresh?.();
    } catch (err) {
      console.error("Failed to reorder plugins:", err);
    } finally {
      setActiveId(null);
    }
  }

  return (
    <Card className="overflow-hidden border-border/50">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-card">
        <div className="flex items-center gap-3">
          <CardTitle className="font-heading text-sm uppercase tracking-wider">
            Plugins
          </CardTitle>
          <Badge variant="secondary" className="font-mono text-[10px]">
            {plugins.length} installed
          </Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
                disabled={reloading}
                onClick={handleReload}
              >
                <RefreshCw
                  className={cn("size-3.5", reloading && "animate-spin")}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reload plugins</TooltipContent>
          </Tooltip>
          <PluginImportDialog onImported={() => onRefresh?.()} />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {plugins.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Puzzle className="size-5 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">
                No plugins installed
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Import a plugin .zip to get started
              </p>
            </div>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <SortableContext
              items={plugins.map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="divide-y divide-border/50">
                {plugins.map((plugin, i) => (
                  <SortablePluginRow
                    key={plugin.id}
                    plugin={plugin}
                    index={i}
                    isDragActive={activeId !== null}
                    expandedUrls={expandedUrls}
                    onToggleUrls={handleToggleUrls}
                    togglingId={togglingId}
                    onToggle={handleToggle}
                    updatingId={updatingId}
                    onStartUpdate={(id) => {
                      setUpdatingId(id);
                      updateFileRef.current?.click();
                    }}
                    confirmRemove={confirmRemove}
                    onConfirmRemove={setConfirmRemove}
                    removingId={removingId}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay dropAnimation={{
              duration: 200,
              easing: "cubic-bezier(0.2, 0, 0, 1)",
            }}>
              {activePlugin ? (
                <div className="flex items-start gap-3 px-5 py-4 bg-card border border-primary/30 rounded-lg shadow-xl shadow-primary/10 ring-1 ring-primary/20">
                  <PluginRowContent
                    plugin={activePlugin}
                    expandedUrls={expandedUrls}
                    togglingId={togglingId}
                    updatingId={updatingId}
                    confirmRemove={confirmRemove}
                    removingId={removingId}
                    isOverlay
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </CardContent>
      <input
        ref={updateFileRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpdate(file);
          else setUpdatingId(null);
        }}
      />
    </Card>
  );
}
