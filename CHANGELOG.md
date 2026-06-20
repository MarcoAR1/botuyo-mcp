# Changelog

All notable changes to **@botuyo/mcp** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Release rule:** every `package.json` version bump MUST add its entry here in the
> **same commit** as the bump. Add changes under `[Unreleased]`, then move them into a
> dated version section when you bump + publish.

## [Unreleased]

## [0.5.0] — 2026-06-20
### Changed
- **`export_agent_family` now writes a readable FOLDER instead of one big file:** `{savePath}/{slug}/family.json` (name, slug, entryVariantKey, base + metadata) plus one `variants/{key}.json` per variant. Smaller files, cleaner diffs, easier hand-editing.
- **`import_agent_family` accepts a folder:** point `filePath` at the exported folder (or its `family.json`) and it reassembles `family.json` + `variants/*.json` into one full-replace payload. Still backward-compatible with a single legacy `.json` file and with inline `family`. Added `src/tools/__tests__/agent_families.spec.ts` coverage for folder export + folder/file/inline import.

### Removed
- Bundled agent definitions and one-off ops scripts no longer live in this repo — they were moved to a private repository where the agent definitions are managed. Removed the example seeds, backups, the bundled family export, the README and the `scripts/` migration tooling.
- Added `agents/` and `agent-families/` to `.gitignore` so exported agent data (from `export_agent_family` / `export_agent_json`) stays out of the package repo.

## [0.4.1] — 2026-06-19
### Changed
- **Ms. Ellis documented as an AgentFamily (variants):** rewrote `agents/README_ms_ellis.md` to reflect the live production setup — an AgentFamily (familyId `6a344975524b9e2d93406f40`, slug `ms-ellis`, entry `nivelador`, 7 variants routed via `switch_variant`) in tenant `69cfa71f02a3b484fd9cecbc` — and added `agent-families/ms-ellis.json` as the canonical source of truth (re-importable with `import_agent_family`).
- The per-agent seeds `agents/ms_ellis_*.json` are now **legacy** (`transfer_to_department` model). They are kept only for the `scripts/migrate_ms_ellis_family.mjs` name-discovery step; re-importing them with `import_agent_json` reverts the family and breaks the variants. Edit the family via `export_agent_family` → edit `agent-families/ms-ellis.json` → `import_agent_family` → `publish_agent_family`.
- **`list_agents` surfaces AgentFamily membership:** the text summary now tags variants with `· family:{variantKey}` (falls back to the family shortId), and the structured `data` carries `familyId`/`variantKey` (the backend MCP API now returns them, so family members are no longer indistinguishable in the listing). Tool description updated to match. Tests: `list_agents.spec.ts` +3 (family member tagged, standalone untagged, fields kept in structured data).

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
