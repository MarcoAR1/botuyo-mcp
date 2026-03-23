import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'

export const EXPORT_AGENT_JSON_TOOL: Tool = {
  name: 'export_agent_json',
  description: `Export the full agent configuration as clean, editable JSON.

Returns the complete agentConfig including identity, stages, connections (graph edges),
channelFlows, enabledTools, channels, and all other settings.

Use import_agent_json to re-import after editing.`,
  inputSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string', description: 'The MongoDB ID of the agent to export' }
    },
    required: ['agentId']
  }
}

export async function exportAgentJsonHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  const agentId = args.agentId as string
  return client.get(`/api/v1/mcp/agents/${agentId}/export`)
}
