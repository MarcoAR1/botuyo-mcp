import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'

export const IMPORT_AGENT_JSON_TOOL: Tool = {
  name: 'import_agent_json',
  description: `Import/replace an agent's full configuration from a JSON object.

This REPLACES the entire agentConfig — use export_agent_json first to get the current config,
edit it, then use this tool to apply the changes.

The agentConfig must include at least 'name' and 'identity'.
All fields (stages, connections, channelFlows, enabledTools, widgetConfig, etc.) will be overwritten.
Internal fields (model, temperature, summaryThreshold, voice.liveModel) are preserved from existing config.

Requires role: owner, admin, or developer.`,
  inputSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string', description: 'The MongoDB ID of the agent to update' },
      agentConfig: {
        type: 'object',
        description: 'The full agentConfig object to replace the existing one. Must include name and identity.',
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
    required: ['agentId', 'agentConfig']
  }
}

export async function importAgentJsonHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  const { agentId, agentConfig } = args
  return client.put(`/api/v1/mcp/agents/${agentId as string}/import`, { agentConfig })
}
