import { definePlugin } from "../../src/plugins/types";

export default definePlugin({
  name: "Example Plugin",
  urlPatterns: ["https://example.com"],
  async download(context) {
    const { url, rootDirectory, helpers, logger } = context;

    logger.info(`Fetching page: ${url}`);

    // Fetch the page HTML
    const html = await helpers.html.fetchPage(url);
    const $ = helpers.html.parse(html);

    // Extract the title
    const title = $("title").text();
    logger.info(`Page title: ${title}`);

    // Save the HTML to disk
    const filename = helpers.string.sanitizeFilename(title) || "page";
    const outputPath = `${rootDirectory}/example/${filename}.html`;

    await helpers.io.ensureDir(`${rootDirectory}/example`);

    const fs = await import("fs/promises");
    await fs.writeFile(outputPath, html);

    return {
      success: true,
      message: `Saved "${title}" to ${outputPath}`,
    };
  },
});
