import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

export const IMPORT_AGENT_JSON_TOOL: Tool = {
  name: 'import_agent_json',
  description: `Import/replace an agent's full configuration from a local JSON file or from a JSON object.

**Preferred workflow:**
1. Use export_agent_json to save the agent config to a local file (auto-saved to ./agents/)
2. Edit the local file as needed
3. Use this tool with filePath pointing to that file to apply the changes

You can provide the config either via:
- filePath: path to a local JSON file (preferred — reads the file from disk)
- agentConfig: inline JSON object (fallback if no file)

If both are provided, filePath takes priority.

The file can contain the metadata fields from export (_exportedAt, _agentId, _apiKey) — they are stripped automatically.
The agentConfig must include at least 'name' and 'identity'.
Internal fields (model, temperature, summaryThreshold, voice.liveModel) are preserved from existing config.

Requires role: owner, admin, or developer.`,
  inputSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string', description: 'The MongoDB ID of the agent to update. If not provided and filePath contains _agentId, that will be used.' },
      filePath: { type: 'string', description: 'Path to a local JSON file with the agent config (e.g. ./agents/mar.json). Preferred over inline agentConfig.' },
      agentConfig: {
        type: 'object',
        description: 'The full agentConfig object (fallback if filePath is not provided). Must include name and identity.',
        properties: {
          name: { type: 'string', description: 'Agent display name' },
          identity: {
            type: 'object',
            description: 'Agent identity (tone, language, objective, customInstructions)',
            properties: {
              tone: { type: 'string' },
              language: { type: 'string' },
              objective: { type: 'string' },
              customInstructions: { type: 'string' }
            }
          },
          stages: { type: 'array', description: 'Array of stage objects with id, name, type, instruction' },
          connections: { type: 'array', description: 'Array of connection edges: { id, from, to, type, condition? }' },
          channelFlows: { type: 'object', description: 'Per-channel flow overrides: { channelName: { connections: [...] } }' },
          enabledTools: { type: 'array', items: { type: 'string' }, description: 'Tool IDs to enable' },
          channels: { type: 'array', items: { type: 'string' }, description: 'Channels: web, whatsapp, phone, etc.' },
          widgetConfig: {
            type: 'object',
            description: 'Widget appearance and behavior config',
            properties: {
              cssVariables: {
                type: 'object',
                description: 'CSS custom properties for widget theming. Keys are variable names (e.g. "primary", "background"), values are HSL values WITHOUT the hsl() wrapper (e.g. "210 100% 50%").'
              },
              welcomeMessage: { type: 'string', description: 'Initial greeting shown when widget opens' },
              placeholder: { type: 'string', description: 'Placeholder text in chat input' },
              position: { type: 'string', description: 'Widget position: bottom-right, bottom-left, etc.' }
            }
          },
          voice: {
            type: 'object',
            description: 'Voice config (profile display name + widgetCallEnabled toggle). liveModel is admin-only and preserved.',
            properties: {
              profile: { type: 'string', description: 'Voice profile display name (e.g. "Coral Cálida")' },
              widgetCallEnabled: { type: 'boolean', description: 'Whether voice calls are enabled in the widget' }
            }
          },
          channelPrompts: { type: 'object', description: 'Per-channel system prompt overrides: { channelName: "prompt text" }' },
          knowledgeDocumentIds: { type: 'array', items: { type: 'string' }, description: 'Knowledge base document IDs for RAG' }
        },
        required: ['name', 'identity']
      }
    },
    required: ['agentId']
  }
}

export async function importAgentJsonHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  let agentId = args.agentId as string | undefined
  let agentConfig = args.agentConfig as Record<string, unknown> | undefined

  // If filePath is provided, read the JSON from local filesystem
  const filePath = args.filePath as string | undefined
  if (filePath) {
    const resolvedPath = resolve(filePath)

    if (!existsSync(resolvedPath)) {
      return {
        success: false,
        error: `File not found: ${resolvedPath}`,
        hint: 'Use export_agent_json first to create a local file, or check the path.'
      }
    }

    try {
      const raw = readFileSync(resolvedPath, 'utf-8')
      const parsed = JSON.parse(raw)

      // Strip export metadata fields — they're informational only
      const { _exportedAt, _agentId, _apiKey, ...config } = parsed

      // Use _agentId from file if not explicitly provided
      if (!agentId && _agentId) {
        agentId = _agentId
      }

      agentConfig = config
    } catch (err: any) {
      return {
        success: false,
        error: `Failed to read/parse file: ${err.message}`,
        path: resolvedPath
      }
    }
  }

  if (!agentId) {
    return {
      success: false,
      error: 'agentId is required. Provide it explicitly or use a file exported with export_agent_json (contains _agentId).'
    }
  }

  if (!agentConfig) {
    return {
      success: false,
      error: 'No agent config provided. Use filePath to point to a local JSON file, or provide agentConfig inline.'
    }
  }

  const result = await client.put(`/api/v1/mcp/agents/${agentId}/import`, { agentConfig })

  return {
    ...(result as any),
    importedFrom: filePath ? resolve(filePath) : 'inline',
  }
}
