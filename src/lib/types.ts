/** Shared type definitions used across client and server code. */

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
}

export interface SettingData {
  key: string;
  type:
    | "string"
    | "number"
    | "boolean"
    | "password"
    | "select"
    | "action"
    | "site-directory-map"
    | "extension-directory-map"
    | "file";
  label: string;
  description?: string;
  section?: string;
  value: string | number | boolean | null;
  defaultValue?: string | number | boolean;
  hidden?: boolean;
  validation?: {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
    options?: Array<{ label: string; value: string }>;
  };
}
