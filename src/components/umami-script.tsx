import Script from "next/script";

const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
const scriptSrc =
  process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL ?? "https://cloud.umami.is/script.js";

export function UmamiScript() {
  if (!websiteId) return null;

  return (
    <Script
      src={scriptSrc}
      data-website-id={websiteId}
      strategy="lazyOnload"
    />
  );
}
