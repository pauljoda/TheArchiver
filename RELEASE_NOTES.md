### Changed
- **Release pipeline** — Split CI into `publish-dev.yml` (builds `dev`/`sha-<short>`/`<version>-<short>` tags on every push to `main`) and `release.yml` (`workflow_dispatch`-only; bumps version, rewrites changelog, tags, pushes `latest`/`X.Y.Z`/`X.Y`/`X`, creates GitHub Release, post-bumps to next `-dev`). `latest` no longer moves on every commit.
- **Versioning policy** — Commits no longer bump `package.json`; between releases the version carries a `-dev` suffix and all changes accumulate under `## [Unreleased]`. Version only changes via the Release workflow running `scripts/release/cut.mjs`. CLAUDE.md and README updated to match.

### Fixed
- **Files** — Selection toolbar actions stay tappable on narrow viewports (stacked layout, wrapped controls, higher stacking order, larger touch targets) so they are not clipped by the file card or covered by animated rows
- iOS Safari no longer zooms into the page when focusing text inputs, textareas, or selects (set `font-size: max(16px, 1em)` globally)

### Removed
- Unused `/api/health` endpoint (not referenced by frontend or Docker)
- Deprecated `useFolderMetadata()` hook (replaced by `useFolderCardData()`)
- Four duplicate `slugify()` implementations consolidated to single export from `plugins/helpers/string`

### Refactored
- **File grid view** — Extracted `FolderThumbnail`, `FileThumbnail`, `SocialMeta`, and `FileCard` into `components/files/grid/` (444 → 55 lines in main file)
- **Move/copy dialog** — Extracted `FolderTreeNode` into its own reusable component file
- **Settings fields** — Extracted `ActionField`, `PasswordField`, `BooleanField`, `SelectField`, and `TextField` into `components/settings/fields/` (261 → 120 lines in dispatcher)
- **Plugin installation** — Extracted shared ZIP extraction, validation, DB registration, and settings setup into `lib/plugin-install.ts`, used by both install routes

### Changed
- **README** — Comprehensive update reflecting all features added since 2.0: scheduled archiving, file preview/streaming, plugin views, community marketplace, built-in Files plugin, video thumbnails, zip downloads, PWA support, and plugin priority reordering
- **README** — API reference expanded from 20 to 50+ endpoints covering files, schedules, plugins, and community routes
- **README** — Added `PLUGINS_DIR` to configuration table, fixed Docker arch description (amd64 only), documented plugin extensions (views, preview providers, thumbnail providers) and updated helper methods
- **Website** — Version bumped from 2.1.0 to 2.2.1 in Hero and Footer components
- **Website** — Features section updated with scheduled archiving, file preview/HLS streaming, plugin views, community marketplace, and PWA support
- **Website** — Plugin showcase updated with community marketplace, drag-and-drop priority, process helpers, and custom views/previews/thumbnails

### Added
- **FlareSolverr** — Core setting `core.flaresolverr_url` (env `FLARESOLVERR_URL`) routes `helpers.html.fetchPage` through FlareSolverr when set; new `helpers.flaresolverr` module (`fetchPage`, `fetchPageWithCookies`, `isAvailable`) for advanced use (e.g. cookies for `downloadFile`)
- **Plugin API: string helpers** — `decodeHtmlEntities()` and `buildFilename()` added to `helpers.string`
- **Plugin API: NFO helpers** — New `helpers.nfo` module with `buildNfo()` function and `NfoBuilder` class for generating XML/NFO metadata files
- **Plugin API: HTTP helpers** — New `helpers.http` module with `createRateLimiter()` for rate-limited API requests with configurable intervals and retry logic
- **Plugin API: type declarations** — `src/plugins/plugin-api.d.ts` provides a self-contained type reference for external plugin authors
- **Marketing site (GitHub Pages)** — Umami Cloud analytics script inlined in `website/src/layouts/Layout.astro`
- **Directory Zip Download** — Directories can now be downloaded as zip archives from the file browser context menu ("Download Zip")
  - New `/api/files/zip` endpoint streams zip archives using the `archiver` library
  - Batch zip download available from the selection toolbar when multiple items are selected
  - Works in both list and grid view modes
- **Video Thumbnails** — Video files (mkv, mp4, avi, etc.) now display an extracted frame as their thumbnail in the file browser grid instead of a generic icon
  - Uses ffmpeg to extract a frame at ~1 second into the video
  - Thumbnails cached in `.thumbs` directories and regenerated only when the source video changes
  - Graceful fallback to the generic video icon when ffmpeg is unavailable or extraction fails
  - Folder preview collages now include video files alongside images
- **Changelog Viewer** — Clicking the version number in the footer opens a dialog showing the full changelog with styled markdown rendering

### Fixed
- SSE event stream no longer spams "Controller is already closed" errors when clients disconnect — the listener now unsubscribes on first failed write
- Changelog viewer now works in Docker — `CHANGELOG.md` is copied into the container image
- Changelog dialog properly sized (wide on desktop, near-fullscreen on mobile) with no text overflow
- Dashboard data (queue, failed, history, schedules) now auto-refreshes every 5 seconds via polling — fixes stale views when jobs complete or status changes occur

### Changed
- Simplified Files and Settings page headers — removed icon boxes and subtitles that visually competed with the main navbar
- Files page no longer shows a redundant "FILES" heading above the file browser card
