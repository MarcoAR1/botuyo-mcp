# Changelog

All notable changes to **@botuyo/mcp** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Release rule:** every `package.json` version bump MUST add its entry here in the
> **same commit** as the bump. Add changes under `[Unreleased]`, then move them into a
> dated version section when you bump + publish.

## [Unreleased]

## [0.4.0] — 2026-06-18
### Added
- **Agent Family tools (11):** manage "one logical agent with many variants" (shared `base` config + per-variant `overrides`) via the MCP namespace `/api/v1/mcp/agent-families`:
  - `list_agent_families`, `get_agent_family`, `create_agent_family`, `update_family_base`, `add_family_variant`, `update_family_variant`, `remove_family_variant`, `publish_agent_family`, `delete_agent_family` (name-confirmation safety), `export_agent_family` (auto-saves a portable JSON to `./agent-families/{slug}.json`), `import_agent_family` (full replace from file or inline; reads `_familyId` from exported files).
  - Write tools require role owner/admin/developer and are subject to the per-plan `maxVariantsPerFamily` limit (both enforced server-side). All defined in `src/tools/agent_families.ts` and registered in `src/tools/index.ts`.

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
