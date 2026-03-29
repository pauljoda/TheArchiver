# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

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
