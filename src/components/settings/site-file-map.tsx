"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface SiteFileMapProps {
  settingKey: string;
  label: string;
  description?: string;
  value: string | null;
  options: Array<{ label: string; value: string }>;
  validation?: {
    accept?: string;
    maxSize?: number;
  };
  onChange: (key: string, value: string) => void;
}

interface FileRow {
  id: string;
  filePath: string;
  domains: string[];
}

type UploadState = "idle" | "uploading" | "error";

function parseFileRows(json: string | null, allDomains: string[]): FileRow[] {
  if (!json) return [];

  let map: Record<string, string>;
  try {
    map = JSON.parse(json);
  } catch {
    return [];
  }

  const grouped: Record<string, string[]> = {};
  for (const [domain, filePath] of Object.entries(map)) {
    if (!filePath) continue;
    if (!grouped[filePath]) grouped[filePath] = [];
    if (allDomains.includes(domain)) grouped[filePath].push(domain);
  }

  return Object.entries(grouped).map(([filePath, domains], i) => ({
    id: `row-${i}-${Date.now()}`,
    filePath,
    domains: domains.sort(),
  }));
}

function serializeRows(rows: FileRow[]): string {
  const map: Record<string, string> = {};
  for (const row of rows) {
    if (!row.filePath.trim()) continue;
    for (const domain of row.domains) {
      map[domain] = row.filePath.trim();
    }
  }
  return JSON.stringify(map);
}

function filenameFromPath(filePath: string): string {
  return filePath.split(/[\\/]/).filter(Boolean).pop() ?? filePath;
}

function splitPluginSettingKey(settingKey: string): {
  pluginId: string;
  localSettingKey: string;
} {
  const parts = settingKey.split(".");
  if (parts.length >= 3 && parts[0] === "plugin") {
    return {
      pluginId: parts[1],
      localSettingKey: parts.slice(2).join("."),
    };
  }
  return { pluginId: "", localSettingKey: settingKey };
}

export function SiteFileMap({
  settingKey,
  label,
  description,
  value,
  options,
  validation,
  onChange,
}: SiteFileMapProps) {
  const allDomains = options.map((o) => o.value);
  const [rows, setRows] = useState<FileRow[]>(() =>
    parseFileRows(value, allDomains)
  );
  const [uploadStates, setUploadStates] = useState<Record<string, UploadState>>(
    {}
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const internalChangeRef = useRef(false);
  const { pluginId, localSettingKey } = splitPluginSettingKey(settingKey);

  useEffect(() => {
    if (internalChangeRef.current) {
      internalChangeRef.current = false;
      return;
    }
    setRows(parseFileRows(value, allDomains));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function emitChange(updatedRows: FileRow[]) {
    internalChangeRef.current = true;
    setRows(updatedRows);
    onChange(settingKey, serializeRows(updatedRows));
  }

  function addRow() {
    emitChange([...rows, { id: `row-${Date.now()}`, filePath: "", domains: [] }]);
  }

  async function deleteUploadedFile(filePath: string) {
    if (!pluginId || !filePath) return;
    await fetch("/api/plugins/files", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pluginId, settingKey: localSettingKey, path: filePath }),
    });
  }

  function removeRow(id: string) {
    const row = rows.find((r) => r.id === id);
    if (row?.filePath) void deleteUploadedFile(row.filePath);
    emitChange(rows.filter((r) => r.id !== id));
  }

  async function uploadFile(rowId: string, file: File) {
    setErrors((prev) => ({ ...prev, [rowId]: "" }));

    if (validation?.maxSize && file.size > validation.maxSize) {
      const maxMB = (validation.maxSize / (1024 * 1024)).toFixed(1);
      setErrors((prev) => ({
        ...prev,
        [rowId]: `File too large. Maximum size is ${maxMB} MB.`,
      }));
      setUploadStates((prev) => ({ ...prev, [rowId]: "error" }));
      return;
    }

    setUploadStates((prev) => ({ ...prev, [rowId]: "uploading" }));

    const formData = new FormData();
    formData.append("pluginId", pluginId);
    formData.append("settingKey", localSettingKey);
    formData.append("managedByMap", "true");
    formData.append("file", file);

    try {
      const res = await fetch("/api/plugins/files", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setErrors((prev) => ({
          ...prev,
          [rowId]: data.error || "Upload failed",
        }));
        setUploadStates((prev) => ({ ...prev, [rowId]: "error" }));
        return;
      }

      const previous = rows.find((row) => row.id === rowId)?.filePath;
      if (previous) void deleteUploadedFile(previous);

      emitChange(
        rows.map((row) =>
          row.id === rowId ? { ...row, filePath: data.path } : row
        )
      );
      setUploadStates((prev) => ({ ...prev, [rowId]: "idle" }));
    } catch {
      setErrors((prev) => ({
        ...prev,
        [rowId]: "Upload failed. Please try again.",
      }));
      setUploadStates((prev) => ({ ...prev, [rowId]: "error" }));
    }
  }

  function addDomain(rowId: string, domain: string) {
    emitChange(
      rows.map((row) =>
        row.id === rowId
          ? { ...row, domains: [...row.domains, domain].sort() }
          : row
      )
    );
  }

  function removeDomain(rowId: string, domain: string) {
    emitChange(
      rows.map((row) =>
        row.id === rowId
          ? { ...row, domains: row.domains.filter((d) => d !== domain) }
          : row
      )
    );
  }

  const assignedDomains = new Set(rows.flatMap((row) => row.domains));

  return (
    <div className="flex flex-col gap-3">
      <Label className="text-sm font-medium">{label}</Label>
      {description && (
        <p className="text-[11px] text-muted-foreground">{description}</p>
      )}

      {rows.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border/50">
          <div className="grid grid-cols-[240px_1fr_40px] gap-2 border-b border-border/50 bg-muted/30 px-3 py-2">
            <span className="font-heading text-[11px] uppercase tracking-wider text-muted-foreground">
              Cookies File
            </span>
            <span className="font-heading text-[11px] uppercase tracking-wider text-muted-foreground">
              Sites
            </span>
            <span />
          </div>

          {rows.map((row) => (
            <SiteFileRowEditor
              key={row.id}
              row={row}
              uploadState={uploadStates[row.id] ?? "idle"}
              error={errors[row.id]}
              accept={validation?.accept}
              allOptions={options}
              assignedDomains={assignedDomains}
              onUpload={(file) => uploadFile(row.id, file)}
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
        className="w-fit gap-1.5 font-heading text-xs uppercase tracking-wider"
      >
        <Plus className="size-3" />
        Add Cookies File
      </Button>
    </div>
  );
}

interface SiteFileRowEditorProps {
  row: FileRow;
  uploadState: UploadState;
  error?: string;
  accept?: string;
  allOptions: Array<{ label: string; value: string }>;
  assignedDomains: Set<string>;
  onUpload: (file: File) => void;
  onAddDomain: (domain: string) => void;
  onRemoveDomain: (domain: string) => void;
  onRemoveRow: () => void;
}

function SiteFileRowEditor({
  row,
  uploadState,
  error,
  accept,
  allOptions,
  assignedDomains,
  onUpload,
  onAddDomain,
  onRemoveDomain,
  onRemoveRow,
}: SiteFileRowEditorProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const skipCloseRef = useRef(false);

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

  const availableDomains = allOptions.filter(
    (option) =>
      !assignedDomains.has(option.value) || row.domains.includes(option.value)
  );
  const filteredDomains = availableDomains.filter(
    (option) =>
      !row.domains.includes(option.value) &&
      option.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="grid grid-cols-[240px_1fr_40px] items-start gap-2 border-b border-border/30 px-3 py-2.5 last:border-b-0">
      <div className="flex min-h-8 flex-col gap-1.5">
        {row.filePath ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "flex h-8 items-center gap-2 rounded-md border border-success/30 bg-success/5 px-2 text-left",
              "transition-colors hover:border-success/50 hover:bg-success/10"
            )}
          >
            <CheckCircle2 className="size-3.5 shrink-0 text-success" />
            <span className="min-w-0 truncate font-mono text-xs">
              {filenameFromPath(row.filePath)}
            </span>
          </button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadState === "uploading"}
            className="h-8 justify-start gap-1.5 px-2 text-xs"
          >
            {uploadState === "uploading" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Upload className="size-3.5" />
            )}
            Upload file
          </Button>
        )}

        {error && (
          <span className="flex items-start gap-1 text-[11px] text-destructive">
            <AlertCircle className="mt-0.5 size-3 shrink-0" />
            {error}
          </span>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onUpload(file);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
        />
      </div>

      <div className="flex flex-col gap-1.5" ref={dropdownRef}>
        <div className="flex min-h-8 flex-wrap items-center gap-1">
          {row.domains.map((domain) => (
            <Badge
              key={domain}
              variant="secondary"
              className="cursor-default gap-1 pr-1 font-mono text-[11px]"
            >
              {domain}
              <button
                type="button"
                onClick={() => onRemoveDomain(domain)}
                className="ml-0.5 rounded-sm p-0.5 hover:bg-foreground/10"
              >
                <X className="size-2.5" />
              </button>
            </Badge>
          ))}

          <button
            type="button"
            onClick={() => {
              setDropdownOpen(!dropdownOpen);
              setSearch("");
              setTimeout(() => searchRef.current?.focus(), 50);
            }}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px]",
              "border border-dashed border-border/60 text-muted-foreground",
              "transition-colors hover:border-foreground/30 hover:text-foreground"
            )}
          >
            <Plus className="size-2.5" />
            Add site
            <ChevronDown className="size-2.5" />
          </button>
        </div>

        {dropdownOpen && (
          <div className="z-10 rounded-md border border-border bg-popover shadow-md">
            <div className="border-b border-border/50 p-1.5">
              <Input
                ref={searchRef}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search sites..."
                className="h-7 text-xs"
              />
            </div>
            <ScrollArea className="max-h-[200px]">
              <div className="p-1">
                {filteredDomains.length === 0 ? (
                  <p className="p-2 text-center text-[11px] text-muted-foreground">
                    {search ? "No matching sites" : "All sites assigned"}
                  </p>
                ) : (
                  filteredDomains.slice(0, 50).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        skipCloseRef.current = true;
                        onAddDomain(option.value);
                        setTimeout(() => searchRef.current?.focus(), 0);
                      }}
                      className="w-full rounded-sm px-2 py-1.5 text-left font-mono text-xs transition-colors hover:bg-muted"
                    >
                      {option.label}
                    </button>
                  ))
                )}
                {filteredDomains.length > 50 && (
                  <p className="p-2 text-center text-[11px] text-muted-foreground">
                    Type to search {filteredDomains.length - 50} more...
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

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
