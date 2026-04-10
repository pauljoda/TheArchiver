"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, X, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface SiteDirectoryMapProps {
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
  domains: string[];
}

function parseFolderRows(
  json: string | null,
  allDomains: string[]
): FolderRow[] {
  if (!json) return [];
  let map: Record<string, string>;
  try {
    map = JSON.parse(json);
  } catch {
    return [];
  }

  // Group by folder name
  const grouped: Record<string, string[]> = {};
  for (const [domain, folder] of Object.entries(map)) {
    if (!folder) continue;
    if (!grouped[folder]) grouped[folder] = [];
    // Only include domains that are in the available options
    if (allDomains.includes(domain)) {
      grouped[folder].push(domain);
    }
  }

  return Object.entries(grouped).map(([folder, domains], i) => ({
    id: `row-${i}-${Date.now()}`,
    folder,
    domains: domains.sort(),
  }));
}

function serializeRows(rows: FolderRow[]): string {
  const map: Record<string, string> = {};
  for (const row of rows) {
    if (!row.folder.trim()) continue;
    for (const domain of row.domains) {
      map[domain] = row.folder.trim();
    }
  }
  return JSON.stringify(map);
}

export function SiteDirectoryMap({
  settingKey,
  label,
  description,
  value,
  options,
  onChange,
}: SiteDirectoryMapProps) {
  const allDomains = options.map((o) => o.value);
  const [rows, setRows] = useState<FolderRow[]>(() =>
    parseFolderRows(value as string | null, allDomains)
  );
  const internalChangeRef = useRef(false);

  // Sync when value changes externally (skip when this component just emitted the update)
  useEffect(() => {
    if (internalChangeRef.current) {
      internalChangeRef.current = false;
      return;
    }
    setRows(parseFolderRows(value as string | null, allDomains));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function emitChange(updatedRows: FolderRow[]) {
    internalChangeRef.current = true;
    setRows(updatedRows);
    onChange(settingKey, serializeRows(updatedRows));
  }

  function addRow() {
    emitChange([
      ...rows,
      { id: `row-${Date.now()}`, folder: "", domains: [] },
    ]);
  }

  function removeRow(id: string) {
    emitChange(rows.filter((r) => r.id !== id));
  }

  function updateFolder(id: string, folder: string) {
    emitChange(rows.map((r) => (r.id === id ? { ...r, folder } : r)));
  }

  function addDomain(rowId: string, domain: string) {
    emitChange(
      rows.map((r) =>
        r.id === rowId ? { ...r, domains: [...r.domains, domain].sort() } : r
      )
    );
  }

  function removeDomain(rowId: string, domain: string) {
    emitChange(
      rows.map((r) =>
        r.id === rowId
          ? { ...r, domains: r.domains.filter((d) => d !== domain) }
          : r
      )
    );
  }

  // Collect all assigned domains across all rows
  const assignedDomains = new Set(rows.flatMap((r) => r.domains));

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
              Sites
            </span>
            <span />
          </div>

          {/* Rows */}
          {rows.map((row) => (
            <FolderRowEditor
              key={row.id}
              row={row}
              allOptions={options}
              assignedDomains={assignedDomains}
              onUpdateFolder={(folder) => updateFolder(row.id, folder)}
              onAddDomain={(domain) => addDomain(row.id, domain)}
              onRemoveDomain={(domain) => removeDomain(row.id, domain)}
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

interface FolderRowEditorProps {
  row: FolderRow;
  allOptions: Array<{ label: string; value: string }>;
  assignedDomains: Set<string>;
  onUpdateFolder: (folder: string) => void;
  onAddDomain: (domain: string) => void;
  onRemoveDomain: (domain: string) => void;
  onRemoveRow: () => void;
}

function FolderRowEditor({
  row,
  allOptions,
  assignedDomains,
  onUpdateFolder,
  onAddDomain,
  onRemoveDomain,
  onRemoveRow,
}: FolderRowEditorProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const skipCloseRef = useRef(false);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (skipCloseRef.current) {
        skipCloseRef.current = false;
        return;
      }
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [dropdownOpen]);

  // Available domains: not assigned elsewhere (but include this row's own)
  const availableDomains = allOptions.filter(
    (o) => !assignedDomains.has(o.value) || row.domains.includes(o.value)
  );

  // Filter for dropdown search
  const filteredDomains = availableDomains.filter(
    (o) =>
      !row.domains.includes(o.value) &&
      o.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="grid grid-cols-[200px_1fr_40px] gap-2 px-3 py-2.5 border-b border-border/30 last:border-b-0 items-start">
      {/* Folder name */}
      <Input
        value={row.folder}
        onChange={(e) => onUpdateFolder(e.target.value)}
        placeholder="Folder name..."
        className="font-mono text-sm h-8"
      />

      {/* Domain picker */}
      <div className="flex flex-col gap-1.5" ref={dropdownRef}>
        {/* Assigned domains as badges */}
        <div className="flex flex-wrap gap-1 min-h-[32px] items-center">
          {row.domains.map((domain) => (
            <Badge
              key={domain}
              variant="secondary"
              className="gap-1 text-[11px] font-mono cursor-default pr-1"
            >
              {domain}
              <button
                type="button"
                onClick={() => onRemoveDomain(domain)}
                className="ml-0.5 rounded-sm hover:bg-foreground/10 p-0.5"
              >
                <X className="size-2.5" />
              </button>
            </Badge>
          ))}

          {/* Add site button / dropdown trigger */}
          <button
            type="button"
            onClick={() => {
              setDropdownOpen(!dropdownOpen);
              setSearch("");
              setTimeout(() => searchRef.current?.focus(), 50);
            }}
            className={cn(
              "inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md",
              "border border-dashed border-border/60 text-muted-foreground",
              "hover:border-foreground/30 hover:text-foreground transition-colors"
            )}
          >
            <Plus className="size-2.5" />
            Add site
            <ChevronDown className="size-2.5" />
          </button>
        </div>

        {/* Dropdown */}
        {dropdownOpen && (
          <div className="rounded-md border border-border bg-popover shadow-md z-10">
            <div className="p-1.5 border-b border-border/50">
              <Input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search sites..."
                className="h-7 text-xs"
              />
            </div>
            <ScrollArea className="max-h-[200px]">
              <div className="p-1">
                {filteredDomains.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground p-2 text-center">
                    {search ? "No matching sites" : "All sites assigned"}
                  </p>
                ) : (
                  filteredDomains.slice(0, 50).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        skipCloseRef.current = true;
                        onAddDomain(opt.value);
                        setTimeout(() => searchRef.current?.focus(), 0);
                      }}
                      className="w-full text-left text-xs font-mono px-2 py-1.5 rounded-sm hover:bg-muted transition-colors"
                    >
                      {opt.label}
                    </button>
                  ))
                )}
                {filteredDomains.length > 50 && (
                  <p className="text-[11px] text-muted-foreground p-2 text-center">
                    Type to search {filteredDomains.length - 50} more...
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
