import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'

export const GET_AGENT_STATUS_TOOL: Tool = {
  name: 'get_agent_status',
  description: 'Get the channel connection status of an agent (WhatsApp, Instagram, Telegram, Web). Shows which channels are connected and provides a direct link to the admin panel to connect missing channels.',
  inputSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string', description: 'The MongoDB ID of the agent' }
    },
    required: ['agentId']
  }
}

export async function getAgentStatusHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  const agentId = args.agentId as string
  return client.get(`/api/v1/mcp/agents/${agentId}/status`)
}
