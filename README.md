# @botuyo/mcp — BotUyo MCP Server

Create and manage BotUyo AI agents directly from your AI coding tools — **no cloning, no building**.

[![npm version](https://img.shields.io/npm/v/@botuyo/mcp.svg)](https://www.npmjs.com/package/@botuyo/mcp)

## Quickstart

### 1. Get your API Key

Go to [admin.botuyo.com](https://admin.botuyo.com) → your tenant → **Settings → API Keys** and copy your `pk_live_...` key.

### 2. Add to your MCP client

The config is the same for **all MCP-compatible tools**:

```json
{
  "mcpServers": {
    "botuyo": {
      "command": "npx",
      "args": ["-y", "@botuyo/mcp"],
      "env": {
        "BOTUYO_API_KEY": "pk_live_your_key_here"
      }
    }
  }
}
```

**Where to put this config:**

| Tool | Config file |
|---|---|
| **Antigravity (VS Code)** | VS Code settings → MCP → Add server |
| **Claude Desktop** | `~/.config/claude/claude_desktop_config.json` |
| **Cursor** | `.cursor/mcp.json` in your project |
| **Windsurf** | `~/.codeium/windsurf/mcp_config.json` |
| **Continue** | `.continue/config.json` |

### 3. Start building agents

Once connected, ask your AI assistant things like:

> *"Create a new agent called 'Soporte' for my tenant"*
> *"Update Mar's objective to focus on sales"*
> *"Add a welcomeStage that greets guests in Spanish"*
> *"Enable the EscalateToHuman and SearchKnowledgeBase tools on Mar"*
> *"Publish the agent"*

## Available Tools

| Tool | Description | Role Required |
|---|---|---|
| `list_agents` | List all agents | viewer+ |
| `get_agent` | Get full agent config | viewer+ |
| `get_agent_status` | Channel status + admin link | viewer+ |
| `create_agent` | Create a new agent | developer+ |
| `update_agent` | Update identity (tone, language, etc.) | developer+ |
| `upsert_stage` | Create/edit a conversation stage | developer+ |
| `list_available_tools` | List tools available to your tenant | viewer+ |
| `update_enabled_tools` | Enable/disable tools on an agent | developer+ |
| `publish_agent` | Publish or unpublish an agent | developer+ |

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

```sh
BOTUYO_API_KEY=pk_live_... npm run inspect
```

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Please note that this project follows a [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

To report a vulnerability, see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © BotUyo
