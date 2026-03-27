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

```bash
# 1. Ensure everything builds and tests pass
npm run build
npm run test

# 2. Bump version in package.json
# 3. Publish to npm
npm publish --access public

# 4. The prepublishOnly script runs build automatically
```

### Version Bumping
- **Patch** (0.3.x): Bug fixes, tool description improvements
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

### Agent CRUD
- `list_agents` — GET all agents for tenant
- `get_agent` — GET single agent by ID
- `create_agent` — POST new agent (draft status)
- `update_agent` — PUT agent fields (identity, config)
- `delete_agent` — DELETE agent (with confirmation)
- `get_agent_status` — GET agent publish status

### Flow / Stages
- `upsert_stage` — PUT stage config (merge semantics for stages, replace for connections)

### Tools Configuration
- `list_available_tools` — GET tools available for the tenant
- `list_base_tools` — GET base tool definitions
- `update_enabled_tools` — PUT enabled tools list
- `configure_agent_tool` — PUT tool-specific config
- `list_tool_configs` — GET all tool configs for agent
- `get_tool_config` — GET single tool config
- `remove_tool_config` — DELETE tool config

### Knowledge Base
- `list_knowledge_documents` — GET knowledge docs
- `delete_knowledge_document` — DELETE knowledge doc
- `associate_knowledge_to_agent` — POST associate doc to agent

### Templates & Import/Export
- `list_templates` — GET available templates
- `create_from_template` — POST create agent from template
- `example_agent` — Returns example agent JSON (no API call)
- `export_agent_json` — GET agent as portable JSON
- `import_agent_json` — POST import agent from JSON

### Tenant Management
- `switch_tenant` — Switch active tenant (hot-swaps token)

### Publishing
- `publish_agent` — POST publish agent (draft → published)

---

## Deploy Script

`deploy.ps1` is a PowerShell script for Windows CI/CD. It:
1. Builds the project
2. Runs tests
3. Bumps version
4. Publishes to npm

On macOS/Linux, use the manual publish workflow above.
