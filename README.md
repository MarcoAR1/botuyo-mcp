# @botuyo/mcp — BotUyo MCP Server

Create and manage BotUyo AI agents directly from your AI coding tools — **no cloning, no building**.

[![npm version](https://img.shields.io/npm/v/@botuyo/mcp.svg)](https://www.npmjs.com/package/@botuyo/mcp)

## Quickstart

The fastest way — one command configures your editor **and** logs you in:

```sh
npx @botuyo/mcp setup
```

It auto-detects your editor (Cursor, VS Code / Antigravity, Claude Desktop), writes the MCP config, and walks you through authentication.

### Manual setup

**1. Add the BotUyo server to your MCP client config:**

```json
{
  "mcpServers": {
    "botuyo": {
      "command": "npx",
      "args": ["-y", "@botuyo/mcp"]
    }
  }
}
```

> No API key goes in the config — authentication is handled by the `auth`/`login` commands below. Some clients (Cursor, VS Code) use the `servers` key instead of `mcpServers`.

| Client | Config file |
|---|---|
| **Cursor** | `.cursor/mcp.json` |
| **VS Code / Antigravity** | `.vscode/mcp.json` |
| **Claude Desktop** | `~/.config/claude/claude_desktop_config.json` (Windows: `%AppData%\Claude\claude_desktop_config.json`) |
| **Windsurf** | `~/.codeium/windsurf/mcp_config.json` |

**2. Authenticate once** — saves a token to `~/.botuyo/credentials.json`:

```sh
npx @botuyo/mcp auth     # browser OAuth (recommended)
# or
npx @botuyo/mcp login    # email + password in the terminal
```

The running MCP server picks up your session automatically — no restart needed. Tokens last 7 days; re-run `auth` or `login` to refresh.

### Start building agents

Once connected, ask your AI assistant things like:

> *"Create a new agent called 'Soporte' for my tenant"*
> *"Update Mar's objective to focus on sales"*
> *"Add a welcomeStage that greets guests in Spanish"*
> *"Enable the EscalateToHuman and SearchKnowledgeBase tools on Mar"*
> *"Publish the agent"*

## CLI commands

```sh
npx @botuyo/mcp setup          # Configure your editor + authenticate (recommended)
npx @botuyo/mcp auth           # Login via browser (OAuth)
npx @botuyo/mcp login          # Login via email + password
npx @botuyo/mcp tenants        # List your tenants
npx @botuyo/mcp switch-tenant  # Switch the active tenant
npx @botuyo/mcp whoami         # Show the current session
npx @botuyo/mcp logout         # Clear stored credentials
```

The server resolves your JWT from `BOTUYO_TOKEN`, falling back to `~/.botuyo/credentials.json`. The backend URL defaults to `https://api.botuyo.com` (override with `BOTUYO_API_URL`).

## Available tools

The server exposes **30 tools**. Read tools (`list_*`, `get_*`, `export_*`) need `viewer+`; write/publish tools need `developer+` (see [Roles](#roles)).

### Agents

| Tool | Description |
|---|---|
| `list_agents` | List all agents in the tenant |
| `get_agent` | Get an agent's full config (identity, stages, enabled tools) |
| `get_agent_status` | Channel connection status + admin link to connect missing channels |
| `create_agent` | Create a new agent |
| `update_agent` | Update identity (tone, language, objective, custom instructions) |
| `delete_agent` | Soft-delete an agent (irreversible; requires explicit confirmation) |
| `publish_agent` | Publish or unpublish an agent (live vs draft) |
| `example_agent` | Return a fully documented example agent config (read-only reference) |

### Conversation flow

| Tool | Description |
|---|---|
| `upsert_stage` | Create or update a named stage in the agent's conversation graph |

### Tools & capabilities

| Tool | Description |
|---|---|
| `list_available_tools` | List tools available to your tenant (core + custom) |
| `update_enabled_tools` | Enable/disable tools on an agent |
| `get_tools_catalog` | Full tool catalog with metadata (configurable, multi-instance, schema, required integrations) |
| `configure_agent_tool` | Create/update a tool's config on an agent (single or multi-instance) |
| `list_tool_configs` | List an agent's tool configs, grouped |
| `get_tool_config` | View the full config of a specific tool on an agent |
| `remove_tool_config` | Remove a tool's configuration |

### Knowledge base

| Tool | Description |
|---|---|
| `list_knowledge_documents` | List knowledge base documents |
| `ingest_knowledge_url` | Ingest a URL into the knowledge base |
| `associate_knowledge_to_agent` | Link knowledge document IDs to an agent |
| `delete_knowledge_document` | Delete a knowledge document and all its chunks |

### Templates

| Tool | Description |
|---|---|
| `list_templates` | List agent templates by industry |
| `create_from_template` | Create a new agent from a template |

### Import / export

| Tool | Description |
|---|---|
| `export_agent_json` | Export an agent's full config as editable JSON |
| `import_agent_json` | Replace an agent's full config from JSON (full overwrite) |

### Avatar & media

| Tool | Description |
|---|---|
| `list_avatars` | List the free 3D avatars in the catalog |
| `select_avatar` | Set a 3D avatar for an agent (catalog ID or custom .glb/.vrm URL) |
| `upload_agent_media` | Upload a local image to the CDN as an agent's avatar/logo |

### Versioning

| Tool | Description |
|---|---|
| `list_agent_versions` | List an agent's saved version snapshots |
| `restore_agent_version` | Roll back an agent to a previous version |

### Account

| Tool | Description |
|---|---|
| `switch_tenant` | Switch the active tenant for the session |

## Roles

| Role | Read | Write | Publish |
|---|---|---|---|
| `owner` | ✅ | ✅ | ✅ |
| `admin` | ✅ | ✅ | ✅ |
| `developer` | ✅ | ✅ | ✅ |
| `viewer` | ✅ | ❌ | ❌ |

## Channel Integrations

Connecting channels (WhatsApp, Instagram, Telegram, Web) must be done from [admin.botuyo.com](https://admin.botuyo.com) — they require interactive flows (QR scans, OAuth, etc.).

Use `get_agent_status` to check which channels are connected. It returns a direct link to the admin panel for any missing channel.

## Build from source

```sh
git clone https://github.com/MarcoAR1/botuyo-mcp.git
cd botuyo-mcp
npm install
npm run build
```

## Test with MCP Inspector

Authenticate first (`npx @botuyo/mcp login`), then run:

```sh
npm run inspect
```

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Please note that this project follows a [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

To report a vulnerability, see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © BotUyo
