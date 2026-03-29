import { getSetting } from "@/lib/settings";

export async function sendNotification(
  title: string,
  message: string,
  tags?: string
): Promise<boolean> {
  const endpoint = getSetting<string>("notifications.ntfy_url");
  if (!endpoint) return false;

  try {
    const headers: Record<string, string> = { Title: title };
    if (tags) headers["Tags"] = tags;

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: message,
    });
    return res.ok;
  } catch (err) {
    console.error("Failed to send notification:", err);
    return false;
  }
}
