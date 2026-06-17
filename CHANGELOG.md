# Changelog

All notable changes to **@botuyo/mcp** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Release rule:** every `package.json` version bump MUST add its entry here in the
> **same commit** as the bump. Add changes under `[Unreleased]`, then move them into a
> dated version section when you bump + publish.

## [Unreleased]

## [0.3.23] — 2026-06-17
### Added
- Dependency on the shared `@botuyo/contracts` package.

### Changed
- CLI commands + MCP tools now source `DEFAULT_API_BASE_URL` and the `VOICE_PROFILES` catalog from `@botuyo/contracts`, so they never drift from the platform's actual config/voices.
- New shared display helpers in `src/format.ts` (`shortId`, `voiceProfileHelp`) reused across `commands/` and `tools/`.

## [0.3.22] — 2026-06-17
### Changed
- `BotuyoApiClient`: requests now retry transient failures (network / 5xx) with exponential backoff + jitter, and detect HTML proxy-block responses (e.g. Netskope) — surfacing a clear error instead of crashing on JSON parse.

### Maintenance
- Synced the Ms. Ellis English-teacher agent templates (`agents/ms_ellis_*.json`) with the live transfer department IDs and added a resilient `scripts/fix_ms_ellis_departments.mjs` (repo-only — not shipped in the npm package).

## [0.3.21] — baseline

Changelog introduced at this version. For prior history, see `git log`.
