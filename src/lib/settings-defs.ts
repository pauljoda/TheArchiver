import type { SettingDefinition } from "./settings";

export const CORE_SETTINGS: SettingDefinition[] = [
  {
    key: "core.download_location",
    group: "core",
    type: "string",
    label: "Download Location",
    description: "Root directory where downloaded files are saved",
    defaultValue: "./downloads",
    envVar: "DOWNLOAD_LOCATION",
    validation: { required: true },
    sortOrder: 0,
  },
  {
    key: "core.max_concurrent_downloads",
    group: "core",
    type: "number",
    label: "Max Concurrent Downloads",
    description: "Maximum number of downloads to process in parallel",
    defaultValue: 10,
    envVar: "MAX_CONCURRENT_DOWNLOADS",
    validation: { required: true, min: 1, max: 50 },
    sortOrder: 1,
  },
  {
    key: "notifications.ntfy_url",
    group: "notifications",
    type: "string",
    label: "ntfy URL",
    description: "ntfy.sh endpoint for push notifications (leave empty to disable)",
    defaultValue: "",
    envVar: "NTFY_URL",
    sortOrder: 0,
  },
];
