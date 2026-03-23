import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'

export const IMPORT_AGENT_JSON_TOOL: Tool = {
  name: 'import_agent_json',
  description: `Import/replace an agent's full configuration from a JSON object.

This REPLACES the entire agentConfig — use export_agent_json first to get the current config,
edit it, then use this tool to apply the changes.

The agentConfig must include at least 'name' and 'identity'.
All fields (stages, connections, channelFlows, enabledTools, etc.) will be overwritten.

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
          channels: { type: 'array', items: { type: 'string' }, description: 'Channels: web, whatsapp, phone, etc.' }
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
