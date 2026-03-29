# The Archiver

A plugin-based web content archiver built with Next.js. Submit URLs, and matching plugins will download and save the content to your local disk.

## Architecture

- **Next.js 16** — Full-stack React app (frontend + API routes + background worker)
- **SQLite** — Embedded database via Drizzle ORM (zero external dependencies)
- **Plugin System** — Drop-in TypeScript plugins matched by URL pattern
- **shadcn/ui** — Dashboard with dark/light theme

Single container deployment — no Redis, no external database, no orchestration required.

## Quick Start

### Docker (recommended)

```bash
docker compose up -d
```

Or pull directly from GHCR:

```bash
docker run -d \
  -p 3000:3000 \
  -v ./data:/data \
  -v ./downloads:/downloads \
  -v ./plugins:/plugins \
  ghcr.io/pauljoda/the-archiver:latest
```

Open [http://localhost:3000](http://localhost:3000) to access the dashboard.

### Development

```bash
npm install
npm run dev
```

This starts the dev server with Turbopack on [http://localhost:3000](http://localhost:3000). Database migrations run automatically at startup.

## Configuration

Copy `.env.example` to `.env.local` and configure as needed:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `file:./data/archiver.db` | SQLite database path |
| `SHARE_LOCATION` | `./downloads` | Root download directory |
| `MAX_CONCURRENT_DOWNLOADS` | `10` | Parallel download limit |
| `NTFY_URL` | — | ntfy notification endpoint |
| `KAVITA_BASE_URL` | — | Kavita server URL |
| `KAVITA_API_KEY` | — | Kavita API key |
| `KAVITA_LIBRARY_ID` | — | Kavita library to scan after downloads |

All settings can also be configured from the Settings page in the UI.

## Plugin Development

Plugins are TypeScript folders in the `plugins/` directory. Each folder contains an `index.ts` that exports a plugin definition.

```
plugins/
  my-plugin/
    index.ts
```

### Plugin API

```typescript
import { definePlugin } from "../../src/plugins/types";

export default definePlugin({
  name: "My Plugin",
  urlPatterns: ["https://example.com"],
  async download(context) {
    const { url, rootDirectory, helpers, logger } = context;

    // Fetch and parse HTML
    const html = await helpers.html.fetchPage(url);
    const $ = helpers.html.parse(html);

    // Download files
    await helpers.io.downloadFile(imageUrl, outputPath);

    // Sanitize filenames
    const safe = helpers.string.sanitizeFilename(title);

    return { success: true, message: "Downloaded content" };
  },
});
```

### Available Helpers

| Helper | Methods |
|--------|---------|
| `helpers.html` | `fetchPage`, `parse`, `select`, `selectAttr` |
| `helpers.io` | `downloadFile`, `downloadFiles`, `ensureDir`, `moveFile` |
| `helpers.url` | `extractBaseUrl`, `extractHostname`, `joinUrl` |
| `helpers.string` | `sanitizeFilename`, `padNumber`, `slugify` |

Plugins can also be installed at runtime via .zip upload from the Plugins tab in the dashboard.

## Features

- **Dashboard** — Stats cards, download queue, failed items, history, and server console
- **Queue Management** — Add URLs, monitor progress, delete items
- **Failed Downloads** — Review errors, retry or clear failures
- **Plugin Management** — View, enable/disable, configure, and import plugins
- **Settings** — Grouped configuration UI with per-plugin settings
- **Real-time Updates** — SSE-based live UI updates
- **Dark/Light Theme** — System-aware with manual toggle
- **Notifications** — ntfy integration for download status
- **Kavita Integration** — Auto-trigger library scans after downloads
- **FFmpeg** — Audio/video merge utility for media downloads

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/download` | Add URL to queue |
| `GET` | `/api/queue` | List queued items |
| `DELETE` | `/api/queue/:id` | Remove queue item |
| `DELETE` | `/api/queue/clear` | Clear all queued items |
| `GET` | `/api/failed` | List failed items |
| `DELETE` | `/api/failed/:id` | Remove failed item |
| `POST` | `/api/failed/:id/retry` | Retry failed item |
| `DELETE` | `/api/failed/clear` | Clear all failed items |
| `GET` | `/api/history` | Download history |
| `GET` | `/api/plugins` | List loaded plugins |
| `GET` | `/api/settings` | Get all settings (grouped) |
| `PUT` | `/api/settings` | Update settings |
| `GET` | `/api/events` | SSE stream for real-time updates |
| `GET` | `/api/logs` | Server console logs |

## Docker Volumes

| Path | Purpose |
|------|---------|
| `/data` | SQLite database |
| `/downloads` | Downloaded content |
| `/plugins` | User-installed plugins |
