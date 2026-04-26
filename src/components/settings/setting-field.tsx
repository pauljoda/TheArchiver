"use client";

import { SiteDirectoryMap } from "./site-directory-map";
import { SiteFileMap } from "./site-file-map";
import { ExtensionDirectoryMap } from "./extension-directory-map";
import { FileUploadField } from "./file-upload-field";
import { ActionField } from "./fields/action-field";
import { PasswordField } from "./fields/password-field";
import { BooleanField } from "./fields/boolean-field";
import { SelectField } from "./fields/select-field";
import { TextField } from "./fields/text-field";

interface SettingFieldProps {
  settingKey: string;
  type: "string" | "number" | "boolean" | "password" | "select" | "action" | "site-directory-map" | "site-file-map" | "extension-directory-map" | "file";
  label: string;
  description?: string;
  value: string | number | boolean | null;
  validation?: {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
    options?: Array<{ label: string; value: string }>;
    accept?: string;
    maxSize?: number;
  };
  onChange: (key: string, value: string | number | boolean) => void;
  onAction?: (key: string) => Promise<{ success: boolean; message: string }>;
}

export function SettingField({
  settingKey,
  type,
  label,
  description,
  value,
  validation,
  onChange,
  onAction,
}: SettingFieldProps) {
  switch (type) {
    case "action":
      return (
        <ActionField
          settingKey={settingKey}
          label={label}
          description={description}
          onAction={onAction}
        />
      );

    case "site-directory-map":
      return (
        <SiteDirectoryMap
          settingKey={settingKey}
          label={label}
          description={description}
          value={value as string | null}
          options={validation?.options ?? []}
          onChange={onChange}
        />
      );

    case "site-file-map":
      return (
        <SiteFileMap
          settingKey={settingKey}
          label={label}
          description={description}
          value={value as string | null}
          options={validation?.options ?? []}
          validation={validation}
          onChange={onChange}
        />
      );

    case "extension-directory-map":
      return (
        <ExtensionDirectoryMap
          settingKey={settingKey}
          label={label}
          description={description}
          value={value as string | null}
          options={validation?.options ?? []}
          onChange={onChange}
        />
      );

    case "file": {
      const parts = settingKey.split(".");
      const pluginId = parts.length >= 3 ? parts[1] : "";
      return (
        <FileUploadField
          settingKey={parts.length >= 3 ? parts.slice(2).join(".") : settingKey}
          pluginId={pluginId}
          label={label}
          description={description}
          value={value as string | null}
          validation={validation}
          onChange={onChange}
        />
      );
    }

    case "boolean":
      return (
        <BooleanField
          settingKey={settingKey}
          label={label}
          description={description}
          value={value}
          onChange={onChange}
        />
      );

    case "select":
      return (
        <SelectField
          settingKey={settingKey}
          label={label}
          description={description}
          value={value}
          options={validation?.options ?? []}
          onChange={onChange}
        />
      );

    case "password":
      return (
        <PasswordField
          settingKey={settingKey}
          label={label}
          description={description}
          value={value}
          onChange={onChange}
        />
      );

    default:
      return (
        <TextField
          settingKey={settingKey}
          type={type === "number" ? "number" : "string"}
          label={label}
          description={description}
          value={value}
          validation={validation}
          onChange={onChange}
        />
      );
  }
}
