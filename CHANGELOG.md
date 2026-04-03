# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- **Scheduled URL Archiving** — Cron-like system to automatically re-queue URLs on a repeating schedule
  - New "Schedules" tab on the dashboard with create, edit, delete, enable/disable, and "Run Now" actions
  - Simple interval picker (every 6h, 12h, daily, weekly) with advanced custom cron expression support
  - Schedule worker polls every 60 seconds and queues due URLs into the standard download queue
  - Each schedule tracks last run time and next scheduled run
- New DB table: `scheduled_urls` with cron expression, enabled toggle, and run timestamps
- New API endpoints: `GET/POST /api/schedules`, `PATCH/DELETE /api/schedules/[id]`, `POST /api/schedules/[id]/run-now`
- New SSE event type: `schedule:changed` for real-time UI updates
- **Plugin priority reordering** — Drag-and-drop to reorder plugins; order determines URL matching priority (first match wins)
- New API endpoint: `PATCH /api/plugins/reorder` — Persist plugin sort order
- PWA support for Mobile Safari "Add to Home Screen" — web manifest, apple-touch-icon, and meta tags

### Changed
- Long URL pattern lists in plugin cards collapse after 3 entries with an expand/collapse toggle

### Added
- **File Detail/Preview View** — Click any file in the browser to open a full-viewport preview overlay
  - **Image preview** for jpg, png, gif, webp, svg, bmp, ico, avif, tiff with click-to-zoom
  - **Video player** for mp4, webm, mov with browser-native controls and seeking (HTTP Range support)
  - **Audio player** for mp3, flac, wav, ogg, aac, wma, m4a
  - **Text/code preview** for txt, md, json, xml, html, css, js, ts, py, sh, yaml, csv, and more — with line numbers and 500KB truncation for large files
  - **PDF preview** via embedded browser viewer
  - **Generic fallback** with file metadata and download button for unsupported formats
  - Left/right arrow key navigation between files in the current directory
  - Toolbar with download, rename, move, copy, and delete actions (reuses existing dialogs)
  - Toggleable file info panel showing name, path, type, size, and modified date
  - URL state sync via `&file=` query parameter for deep-linking and browser back support
- New API endpoint: `GET /api/files/preview?path=` — Serves files inline with correct MIME types and HTTP 206 Range support
- **Plugin View System** — Plugins can now ship custom file explorer views as compiled JS bundles
  - New `viewProvider` field in plugin manifests declares a view with `viewId`, `label`, `icon`, and `entryPoint`
  - View provider registry tracks which plugins can render which directories (based on `save_directory` setting)
  - `PluginViewHost` component dynamically loads plugin JS bundles via `<script>` tag and provides a rich API (`fetchFiles`, `fetchFile`, `navigate`, theme colors)
  - View toggle bar allows switching between "Files" (standard browser) and plugin-provided views
  - When multiple plugins claim the same directory, all views appear as toggle options
  - Plugin views get full-page width for immersive experiences
- **Reddit Browser View** (Socials plugin) — Faux Reddit interface for browsing archived Reddit content
  - Subreddit grid at root level with post counts and sample thumbnails
  - Post card grid per subreddit with score, author, date, and flair from Post.nfo metadata
  - Full post detail view with image gallery (lightbox, prev/next navigation, thumbnails), parsed metadata, and threaded comment tree
  - Reddit-inspired styling with nested comment indentation, upvote badges, author highlighting, and flair tags
  - Vanilla JS bundle (zero dependencies) with CSS custom property theme integration
- New API endpoints:
  - `GET /api/files/view-providers?path=` — Query which plugin views can render a directory
  - `GET /api/plugins/view?pluginId=` — Serve plugin view JS bundles

### Changed
- Layout container (`max-w-7xl`) moved from root layout to individual pages, allowing the files page to go full-width when a plugin view is active

### Added
- Built-in "Files" plugin — universal fallback that downloads any file type when no other plugin matches a URL
- Extension-to-folder routing: files are automatically organized into folders (Images, Videos, Audio, Documents, Archives, etc.) based on their extension
- New `extension-directory-map` setting type with chip-based autocomplete UI for managing extension-to-folder mappings
- "Organize by Hostname" toggle to optionally create per-website subfolders within each extension folder
- Query parameter resilience: downloads retry with stripped query params if the original URL fails
- Users can add custom file extensions and folder mappings beyond the 150+ seeded defaults
- Built-in plugins are protected from deletion (can only be disabled)
- History clearing: "Clear All" button to delete all history entries, and per-entry delete button on hover
- API routes: `DELETE /api/history/clear` and `DELETE /api/history/[id]`

### Changed
- Plugin settings now persist across uninstall/reinstall — removing a plugin keeps its settings in the database so re-adding recovers previous configuration
- Plugin removal UI offers two options: "Remove" (keep settings) and "Purge Settings" (remove plugin and all its settings)

### Fixed
- Settings page no longer shows settings groups for disabled or uninstalled plugins — only enabled plugin settings are visible

### Fixed
- Settings with null values were stored as the string `"null"` instead of actual null, causing corrupted values on read
- Removed misleading progress bars from dashboard stat cards (quantities don't have progress)

### Removed
- Kavita settings from core settings — now managed by plugin

### Fixed
- Plugin import dialog drop zone now actually accepts drag-and-drop files (was visual-only, missing event handlers)
- Plugin `exec()` calls with relative paths break after `cd` — plugin loader now auto-resolves relative paths to absolute
- CBZ/zip creation fails in Docker — `zip` package was missing from Alpine image
- `helpers.io.createZip()` added using `execFile` with args array (shell-safe for special characters)
- Server console log lines now have proper spacing between timestamp, level, and message
- Server console log viewer wraps properly on mobile screens
- Orphaned core settings (e.g. removed Kavita group) are now cleaned up from the database on boot

### Added
- **File manager operations** — full file management from the browser UI
  - Create new folders within the current directory
  - Rename files and folders via context menu
  - Move files/folders to another directory with folder tree picker
  - Copy files/folders to another directory with folder tree picker
  - Multi-select with checkboxes (shift+click for range, Ctrl/Cmd+A for all)
  - Batch move, copy, and delete for selected items
  - Selection toolbar with quick actions
  - Per-row dropdown menu replacing inline action buttons
  - New API endpoints: POST (mkdir), PATCH (rename), PUT (move/copy), batch DELETE
  - `resolveSafeNewPath()` security helper for target paths that don't yet exist
- **Plugin update support** — importing a plugin that already exists now updates it in-place (preserves settings)
- Per-plugin update button (upload icon) in the plugin list for quick updates
- **File browser** (`/files`) — browse, download, and delete files from the download directory
  - Breadcrumb navigation with parent directory traversal
  - Streaming file downloads (no memory buffering for large files)
  - Per-file type icons (image, video, audio, archive, document)
  - Delete with inline confirmation (matches plugin-list pattern)
  - Column headers for name, size, and modified date
  - Path traversal prevention with symlink escape detection
- FolderOpen icon link in header navigation for quick access to file browser
- `formatFileSize` and `formatRelativeDate` utility functions
- `GET /api/download?url=...` — queue downloads via query parameter (restores old URL-based API)
- Reload plugins button in the plugin management UI
- `POST /api/plugins/reload` endpoint to reload all plugins without restarting
- Plugin registry automatically reloads after a new plugin is imported

### Fixed
- Newly imported plugins now register as valid endpoints immediately without requiring a restart
- Docker: `PLUGINS_DIR` env var (`/plugins`) ensures the app reads from the volume-mounted path instead of `/app/plugins`
- Plugin registry, settings, and DB connection singletons all use `globalThis` so state is shared across all Next.js webpack bundles — fixes plugin URL matching, settings persistence, and env default display
- Orphaned plugin settings (auth tokens from plugin actions) are re-registered as hidden on every boot, preventing them from showing in the settings UI after restart
- Settings form now remounts when switching groups (`key={activeGroup}`) — fixes values appearing blank when navigating between Core/Notifications/Plugin settings
- Server console log viewer now works in Docker/production — replaced dev-only `.next/dev/logs` file reader with an in-memory ring buffer that captures `console.log/warn/error` output
- Plugin action auth tokens (access_key, logged_in_sig, etc.) no longer create a visible `__INTERNAL` settings group — stored as hidden settings under the plugin's own group
- Settings seeded from env vars (ntfy URL, Kavita config, etc.) now display their values in the UI even if the DB was initialized before the env var was set
- Legacy `plugin:__internal` DB entries are migrated to the correct plugin group on startup
- Internal plugin settings are now properly registered in the definitions map so `getSetting`/`setSetting` work for auth tokens

## [2.0.1] - 2026-03-29

### Fixed
- `use-fetch` hook now uses AbortController to cancel in-flight requests on unmount
- `console-log` polling uses AbortController cleanup and `useMemo` for filtered logs
- `settings-form` setTimeout for "Saved" indicator now cleans up on unmount
- Settings page useEffect no longer has circular `activeGroup` dependency
- Download worker parallelizes DB operations (history insert + queue delete) via `Promise.all`
- Download worker fires notifications and library scans non-blocking (no longer awaited)
- Removed redundant re-fetch after plugin PATCH update
- Logs API route uses async `fs.readFile` instead of blocking `readFileSync`, limits to last 500 lines
- Added try-catch error handling to queue, failed, and history GET endpoints

## [2.0.0] - 2026-03-29

### Changed
- **Complete rewrite** from .NET Aspire microservices to a Next.js monolith
- Replaced SQL Server with SQLite (via Drizzle ORM) — zero external database required
- Replaced BullMQ/Redis job queue with SQLite polling worker — single container deployment
- Replaced Razor/Bootstrap monitor UI with React + shadcn/ui + Tailwind CSS
- Reduced from 5+ containers to a single Docker container
- New "Vault" UI theme — industrial dark aesthetic with amber accents, JetBrains Mono + DM Sans typography

### Added
- Plugin system with TypeScript `definePlugin()` API and runtime loading from `plugins/` directory
- Plugin import via .zip upload with automatic manifest validation
- Plugin settings system with dynamic registration and UI generation
- Real-time dashboard updates via Server-Sent Events (SSE)
- Server console log viewer with color-coded levels and scanline effect
- Download history with status tracking and timestamps
- Settings page with grouped navigation and per-plugin configuration
- Kavita library scan integration with configurable delay
- ntfy notification support for download status
- FFmpeg audio/video merge utility
- Health check endpoint (`/api/health`)
- GitHub Actions CI/CD workflow for multi-arch Docker builds to GHCR
- Database migrations run automatically at server startup via Next.js instrumentation hook
- Dark/light theme with system-aware toggle

### Removed
- .NET Aspire orchestration and all C# projects
- SQL Server and Entity Framework
- Redis dependency
- Separate migration service container
- Separate ffmpeg container
- Old GitHub Actions workflow for .NET container publishing
