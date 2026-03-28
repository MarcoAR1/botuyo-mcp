import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'

export const LIST_AGENT_VERSIONS_TOOL: Tool = {
  name: 'list_agent_versions',
  description:
    'List version history for an agent. Returns all saved snapshots with version number, change source, and timestamp. Useful to see what changed and when before deciding to restore.',
  inputSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string', description: 'The MongoDB ID of the agent' }
    },
    required: ['agentId']
  }
}

export async function listAgentVersionsHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  const agentId = args.agentId as string
  return client.get(`/api/v1/mcp/agents/${agentId}/versions`)
}
