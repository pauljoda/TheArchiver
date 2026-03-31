"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ExtensionDirectoryMapProps {
  settingKey: string;
  label: string;
  description?: string;
  value: string | null;
  options: Array<{ label: string; value: string }>;
  onChange: (key: string, value: string) => void;
}

interface FolderRow {
  id: string;
  folder: string;
  extensions: string[];
}

function parseFolderRows(json: string | null): FolderRow[] {
  if (!json) return [];
  let map: Record<string, string>;
  try {
    map = JSON.parse(json);
  } catch {
    return [];
  }

  const grouped: Record<string, string[]> = {};
  for (const [ext, folder] of Object.entries(map)) {
    if (!folder) continue;
    if (!grouped[folder]) grouped[folder] = [];
    grouped[folder].push(ext);
  }

  return Object.entries(grouped).map(([folder, extensions], i) => ({
    id: `row-${i}-${Date.now()}`,
    folder,
    extensions: extensions.sort(),
  }));
}

function serializeRows(rows: FolderRow[]): string {
  const map: Record<string, string> = {};
  for (const row of rows) {
    if (!row.folder.trim()) continue;
    for (const ext of row.extensions) {
      map[ext] = row.folder.trim();
    }
  }
  return JSON.stringify(map);
}

/** Normalize user input into a dotted lowercase extension */
function normalizeExtension(input: string): string {
  const trimmed = input.trim().toLowerCase().replace(/[^a-z0-9.]/g, "");
  if (!trimmed) return "";
  return trimmed.startsWith(".") ? trimmed : `.${trimmed}`;
}

export function ExtensionDirectoryMap({
  settingKey,
  label,
  description,
  value,
  options,
  onChange,
}: ExtensionDirectoryMapProps) {
  const [rows, setRows] = useState<FolderRow[]>(() =>
    parseFolderRows(value as string | null)
  );
  const internalChangeRef = useRef(false);

  useEffect(() => {
    // Skip re-parse when the change originated from within this component
    if (internalChangeRef.current) {
      internalChangeRef.current = false;
      return;
    }
    setRows(parseFolderRows(value as string | null));
  }, [value]);

  function emitChange(updatedRows: FolderRow[]) {
    internalChangeRef.current = true;
    setRows(updatedRows);
    onChange(settingKey, serializeRows(updatedRows));
  }

  function addRow() {
    emitChange([
      ...rows,
      { id: `row-${Date.now()}`, folder: "", extensions: [] },
    ]);
  }

  function removeRow(id: string) {
    emitChange(rows.filter((r) => r.id !== id));
  }

  function updateFolder(id: string, folder: string) {
    emitChange(rows.map((r) => (r.id === id ? { ...r, folder } : r)));
  }

  function addExtension(rowId: string, ext: string) {
    emitChange(
      rows.map((r) =>
        r.id === rowId
          ? { ...r, extensions: [...r.extensions, ext].sort() }
          : r
      )
    );
  }

  function removeExtension(rowId: string, ext: string) {
    emitChange(
      rows.map((r) =>
        r.id === rowId
          ? { ...r, extensions: r.extensions.filter((e) => e !== ext) }
          : r
      )
    );
  }

  const assignedExtensions = new Set(rows.flatMap((r) => r.extensions));

  return (
    <div className="flex flex-col gap-3">
      <Label className="text-sm font-medium">{label}</Label>
      {description && (
        <p className="text-[11px] text-muted-foreground">{description}</p>
      )}

      {rows.length > 0 && (
        <div className="rounded-lg border border-border/50 overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[200px_1fr_40px] gap-2 px-3 py-2 bg-muted/30 border-b border-border/50">
            <span className="text-[11px] font-heading uppercase tracking-wider text-muted-foreground">
              Folder
            </span>
            <span className="text-[11px] font-heading uppercase tracking-wider text-muted-foreground">
              Extensions
            </span>
            <span />
          </div>

          {/* Rows */}
          {rows.map((row) => (
            <ExtensionRowEditor
              key={row.id}
              row={row}
              allOptions={options}
              assignedExtensions={assignedExtensions}
              onUpdateFolder={(folder) => updateFolder(row.id, folder)}
              onAddExtension={(ext) => addExtension(row.id, ext)}
              onRemoveExtension={(ext) => removeExtension(row.id, ext)}
              onRemoveRow={() => removeRow(row.id)}
            />
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addRow}
        className="gap-1.5 font-heading text-xs uppercase tracking-wider w-fit"
      >
        <Plus className="size-3" />
        Add Folder
      </Button>
    </div>
  );
}

// ─── Row Editor ───

interface ExtensionRowEditorProps {
  row: FolderRow;
  allOptions: Array<{ label: string; value: string }>;
  assignedExtensions: Set<string>;
  onUpdateFolder: (folder: string) => void;
  onAddExtension: (ext: string) => void;
  onRemoveExtension: (ext: string) => void;
  onRemoveRow: () => void;
}

function ExtensionRowEditor({
  row,
  allOptions,
  assignedExtensions,
  onUpdateFolder,
  onAddExtension,
  onRemoveExtension,
  onRemoveRow,
}: ExtensionRowEditorProps) {
  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [dropdownOpen]);

  // Available extensions: not assigned elsewhere (but include this row's own)
  const availableOptions = allOptions.filter(
    (o) => !assignedExtensions.has(o.value) || row.extensions.includes(o.value)
  );

  // Build dropdown items from search input
  const normalized = normalizeExtension(search);

  const filteredOptions = search.trim()
    ? availableOptions.filter(
        (o) =>
          !row.extensions.includes(o.value) &&
          o.value.includes(normalized)
      )
    : [];

  // Determine if user is typing a custom extension not in the known list
  const isValidCustom =
    normalized.length >= 2 &&
    !allOptions.some((o) => o.value === normalized) &&
    !row.extensions.includes(normalized) &&
    !assignedExtensions.has(normalized);

  // Build final dropdown items: matching known extensions + optional custom "Add" entry
  const dropdownItems: Array<{
    value: string;
    label: string;
    isCustom: boolean;
  }> = [
    ...filteredOptions.slice(0, 50).map((o) => ({
      value: o.value,
      label: o.label,
      isCustom: false,
    })),
    ...(isValidCustom
      ? [{ value: normalized, label: `Add ${normalized}`, isCustom: true }]
      : []),
  ];

  // Reset highlight when dropdown items change
  useEffect(() => {
    setHighlightIndex(0);
  }, [search]);

  const selectItem = useCallback(
    (ext: string) => {
      onAddExtension(ext);
      setSearch("");
      setDropdownOpen(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    [onAddExtension]
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (dropdownItems.length > 0) {
        const idx = Math.min(highlightIndex, dropdownItems.length - 1);
        selectItem(dropdownItems[idx].value);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, dropdownItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Escape") {
      setDropdownOpen(false);
      setSearch("");
    } else if (
      e.key === "Backspace" &&
      search === "" &&
      row.extensions.length > 0
    ) {
      // Remove last extension chip when backspacing on empty input
      onRemoveExtension(row.extensions[row.extensions.length - 1]);
    }
  }

  const showDropdown = dropdownOpen && search.trim().length > 0 && dropdownItems.length > 0;

  return (
    <div className="grid grid-cols-[200px_1fr_40px] gap-2 px-3 py-2.5 border-b border-border/30 last:border-b-0 items-start">
      {/* Folder name */}
      <Input
        value={row.folder}
        onChange={(e) => onUpdateFolder(e.target.value)}
        placeholder="Folder name..."
        className="font-mono text-sm h-8"
      />

      {/* Extension chip area + autocomplete input */}
      <div className="flex flex-col gap-1.5 relative" ref={containerRef}>
        <div
          className={cn(
            "flex flex-wrap gap-1 items-center min-h-[32px]",
            "rounded-lg border border-input bg-transparent px-1.5 py-1",
            "transition-colors",
            "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
            "dark:bg-input/30"
          )}
          onClick={() => inputRef.current?.focus()}
        >
          {/* Extension chips */}
          {row.extensions.map((ext) => (
            <Badge
              key={ext}
              variant="secondary"
              className="gap-1 text-[11px] font-mono cursor-default pr-1 shrink-0"
            >
              {ext}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveExtension(ext);
                }}
                className="ml-0.5 rounded-sm hover:bg-foreground/10 p-0.5"
              >
                <X className="size-2.5" />
              </button>
            </Badge>
          ))}

          {/* Inline autocomplete input */}
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setDropdownOpen(true);
            }}
            onFocus={() => {
              if (search.trim()) setDropdownOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              row.extensions.length === 0 ? "Type extension..." : ""
            }
            className={cn(
              "flex-1 min-w-[80px] bg-transparent outline-none",
              "text-xs font-mono placeholder:text-muted-foreground/60",
              "h-5"
            )}
          />
        </div>

        {/* Dropdown */}
        {showDropdown && (
          <div className="absolute top-full left-0 right-10 mt-1 rounded-md border border-border bg-popover shadow-md z-20">
            <ScrollArea className="max-h-[200px]">
              <div className="p-1">
                {dropdownItems.map((item, idx) => (
                  <button
                    key={item.value}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectItem(item.value);
                    }}
                    onMouseEnter={() => setHighlightIndex(idx)}
                    className={cn(
                      "w-full text-left text-xs px-2 py-1.5 rounded-sm transition-colors",
                      idx === highlightIndex
                        ? "bg-muted text-foreground"
                        : "text-foreground/80 hover:bg-muted/50",
                      item.isCustom
                        ? "font-mono italic text-muted-foreground"
                        : "font-mono"
                    )}
                  >
                    {item.isCustom ? (
                      <span className="flex items-center gap-1.5">
                        <Plus className="size-2.5 text-muted-foreground" />
                        {item.label}
                      </span>
                    ) : (
                      item.label
                    )}
                  </button>
                ))}
                {filteredOptions.length > 50 && (
                  <p className="text-[11px] text-muted-foreground p-2 text-center">
                    Type to narrow {filteredOptions.length - 50} more...
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Delete row */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onRemoveRow}
        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}
