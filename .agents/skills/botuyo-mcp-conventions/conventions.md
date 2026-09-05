# BotUyo MCP — Conventions & How-To Guide

> This file contains patterns that CAN change over time. For immutable rules, see [SKILL.md](./SKILL.md).

## How to Add a New MCP Tool

### Step-by-step checklist:

1. **Create tool file** at `src/tools/{tool_name}.ts`
2. **Define the Tool object** with `name`, `description`, and `inputSchema`
3. **Implement the handler function** that calls `client.*`
4. **Register in `src/tools/index.ts`** — import + add to `ALL_TOOLS[]` + `TOOL_HANDLERS{}`
5. **Create test** at `src/tools/__tests__/{tool_name}.spec.ts`
6. **Build** — `npm run build` (zero errors)
7. **Test** — `npm run test` (all pass)
8. **Inspect** — `npm run inspect` (verify tool shows up and works)

### Naming Conventions

| What | Convention | Example |
|------|-----------|---------|
| Tool file | `snake_case.ts` | `create_agent.ts` |
| Tool name (MCP) | `snake_case` | `create_agent` |
| Tool const | `UPPER_SNAKE_TOOL` | `CREATE_AGENT_TOOL` |
| Handler function | `camelCaseHandler` | `createAgentHandler` |
| Test file | `snake_case.spec.ts` | `create_agent.spec.ts` |
| Handler key | matches `Tool.name` | `create_agent: createAgentHandler` |

### Tool Description Best Practices

- Start with a verb: "Create", "List", "Update", "Delete"
- Include role requirements: "Requires role: owner, admin, or developer."
- Explain merge vs replace behavior for update operations
- Mention any side effects (e.g., "Agent is created in draft status")

---

## How to Add a New CLI Command

1. Create file at `src/commands/{command_name}.ts`
2. Export an async `run{CommandName}` function
3. Add the `case` in `src/index.ts` `main()` switch statement
4. Use dynamic `import()` for the command module (keeps startup fast)

```typescript
// In index.ts main() switch:
case 'my-command': {
  const { runMyCommand } = await import('./commands/my_command.js')
  await runMyCommand(rest)
  return
}
```

### CLI Output Rules
- Use `console.log` for normal output
- Use `console.error` for errors
- Use emoji prefixes: ✅ success, ❌ error, ⚠️ warning
- Always provide actionable next steps on error

---

## Publish Workflow

Publishing is **automated via GitHub Actions** (`.github/workflows/publish.yml`) using
**OIDC Trusted Publishing** — no `NPM_TOKEN` secret. The flow mirrors `botuyo-widget-chatbot`.

```bash
# 1. Ensure everything builds and tests pass
npm run build
npm run test

# 2. Bump version + add the CHANGELOG entry in the SAME commit
npm version patch   # edits package.json + package-lock.json, commits, tags

# 3. Push to main — the workflow triggers on changes to package.json
git push origin main --follow-tags
```

On push to `main` (path filter `package.json`), the workflow builds, compares the local
version against the published one, and runs `npm publish --access public` **with signed
provenance** via OIDC. If the version already exists, the publish is skipped (idempotent).

- **Trusted Publisher** must be configured once on npmjs.org for `@botuyo/mcp`
  (repo `MarcoAR1/botuyo-mcp`, workflow `publish.yml`).
- **Manual fallback:** `npm publish --access public` from a machine with npm registry
  access and `npm login` (the `prepublishOnly` script runs the build automatically).
  Note: corporate proxies (Netskope) may block both `npm publish` and `git push` over
  HTTPS — prefer the CI path.
- `deploy.ps1` is a legacy Windows helper; the CI workflow is the source of truth.

### Version Bumping
- **Patch** (0.x.y): Bug fixes, tool/description doc improvements
- **Minor** (0.x.0): New tools, new CLI commands
- **Major** (x.0.0): Breaking changes to tool schemas or client API

---

## API Response Format

The BotUyo backend returns responses in this format:

```json
{
  "success": true,
  "data": { ... }
}
```

Or on error:
```json
{
  "success": false,
  "error": "Error message"
}
```

The `client.ts` `parseJson()` method handles both cases. Tool handlers receive the full response object — they don't need to unwrap `.data`.

---

## Tool Categories

> **48 tools total.** The MCP tool `name` is the source of truth — note that some
> file names differ from the exposed name (e.g. `list_base_tools.ts` → `get_tools_catalog`,
> `list_knowledge_docs.ts` → `list_knowledge_documents`, `delete_knowledge_doc.ts` →
> `delete_knowledge_document`, `associate_knowledge.ts` → `associate_knowledge_to_agent`).

### Agent CRUD (8)
- `list_agents` — GET all agents for tenant (tags AgentFamily members)
- `get_agent` — GET single agent by ID (editable config under `data.agentConfig`)
- `get_agent_status` — GET channel connection status + admin link
- `create_agent` — POST new agent (draft status)
- `update_agent` — PUT agent identity/config (merge semantics)
- `delete_agent` — DELETE agent (name-confirmation required)
- `publish_agent` — POST publish/unpublish (draft ↔ live)
- `example_agent` — Returns a documented example config (no API call)

### Flow / Stages (1)
- `upsert_stage` — PUT stage config (merge for stages, replace for connections)

### Tools Configuration (7)
- `list_available_tools` — GET tools available for the tenant (core + custom)
- `get_tools_catalog` — GET full tool catalog with metadata (file: `list_base_tools.ts`)
- `update_enabled_tools` — PUT enabled tools list
- `configure_agent_tool` — PUT tool-specific config (single or multi-instance)
- `list_tool_configs` — GET all tool configs for agent
- `get_tool_config` — GET single tool config
- `remove_tool_config` — DELETE tool config

### Knowledge Base (4)
- `list_knowledge_documents` — GET knowledge docs
- `ingest_knowledge_url` — POST a URL to scrape + index
- `associate_knowledge_to_agent` — POST associate doc(s) to agent
- `delete_knowledge_document` — DELETE knowledge doc + chunks

### Templates & Import/Export (4)
- `list_templates` — GET available templates by industry
- `create_from_template` — POST create agent from template
- `export_agent_json` — GET agent as portable JSON
- `import_agent_json` — POST full-replace agent config from JSON

### Avatar & Media (3)
- `list_avatars` — GET the free 3D avatar catalog
- `select_avatar` — PUT a 3D avatar (catalog ID or custom .glb/.vrm URL)
- `upload_agent_media` — Upload a local image to the CDN as avatar/logo

### Versioning (2)
- `list_agent_versions` — GET saved version snapshots
- `restore_agent_version` — Roll back to a previous version

### Agent Families (12)
- `list_agent_families`, `get_agent_family`, `create_agent_family`,
  `update_family_base`, `add_family_variant`, `update_family_variant`,
  `remove_family_variant`, `publish_agent_family`, `delete_agent_family`
  (name-confirmation), `export_agent_family` (folder export), `import_agent_family`
  (folder/file/inline, can create), `audit_agent_family` (read-only quality audit)

### Channels (3)
- `list_channels` — GET tenant channels + status (file: `channels.ts`). **Secrets are never
  returned** — only `credentialsSet` (which credential keys are configured).
- `connect_channel` — POST connect a channel with its secret. Accepts `credentials` (literal) or
  `credentialsFromEnv` (map credentialKey → env var name, resolved from the MCP server's own
  `process.env` so the secret never enters the chat). **owner/admin only.**
- `disconnect_channel` — DELETE a channel by id. **owner/admin only.**

Backend: these call `/api/v1/mcp/channels/*` (`McpChannelController`), which reuses the shared
ConnectChannel/DisconnectChannel use cases. **NEVER log a secret; NEVER return a secret value.**

### Integrations (3)
- `list_integrations` — GET catalog + installed (file: `integrations.ts`). **Secrets never returned**
  — only `configKeys`.
- `configure_integration` — POST install/update a tenant integration with its secret (`config`
  literal or `configFromEnv` env-ref). **owner/admin only.** Backed by `IntegrationService`.
- `remove_integration` — DELETE (uninstall). **owner/admin only.**

Backend: `/api/v1/mcp/integrations/*` (`McpIntegrationController`), reusing `IntegrationService`.
**RULE 0:** integrations = agent/tenant infra; Recruiting-owned config (email senders) is NOT here.

### Tenant Management (1)
- `switch_tenant` — Switch active tenant (hot-swaps token)

All write/publish tools require role owner/admin/developer; channel/integration connect/configure
require owner/admin; read tools (`list_*`, `get_*`, `export_*`, `audit_*`, `example_agent`) work for viewer+.

---

## Deploy Script

`deploy.ps1` is a PowerShell script for Windows CI/CD. It:
1. Builds the project
2. Runs tests
3. Bumps version
4. Publishes to npm

On macOS/Linux, use the manual publish workflow above.
