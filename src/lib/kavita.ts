import { getSetting } from "@/lib/settings";

interface KavitaConfig {
  baseUrl: string;
  apiKey: string;
  pluginName: string;
  libraryId: string;
  forceScan: boolean;
  scanDelayMs: number;
}

function getConfig(): KavitaConfig | null {
  const baseUrl = getSetting<string>("kavita.base_url");
  const apiKey = getSetting<string>("kavita.api_key");
  if (!baseUrl || !apiKey) return null;

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey,
    pluginName: getSetting<string>("kavita.plugin_name") || "Downloader",
    libraryId: getSetting<string>("kavita.library_id") || "",
    forceScan: getSetting<boolean>("kavita.force_scan"),
    scanDelayMs: getSetting<number>("kavita.scan_delay_ms") ?? 15000,
  };
}

async function getToken(config: KavitaConfig): Promise<string | null> {
  try {
    const res = await fetch(`${config.baseUrl}/api/Plugin/authenticate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: config.apiKey,
        pluginName: config.pluginName,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.token;
  } catch (err) {
    console.error("Failed to authenticate with Kavita:", err);
    return null;
  }
}

export async function triggerLibraryScan(): Promise<boolean> {
  const config = getConfig();
  if (!config || !config.libraryId) return false;

  const token = await getToken(config);
  if (!token) return false;

  // Wait configured delay before scanning
  if (config.scanDelayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, config.scanDelayMs));
  }

  try {
    const res = await fetch(
      `${config.baseUrl}/api/Library/scan?libraryId=${config.libraryId}&force=${config.forceScan}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );
    return res.ok;
  } catch (err) {
    console.error("Failed to trigger Kavita scan:", err);
    return false;
  }
}
