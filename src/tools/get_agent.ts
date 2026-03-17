import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'

export const GET_AGENT_TOOL: Tool = {
  name: 'get_agent',
  description: 'Get the full configuration of a specific agent, including identity (tone, language, objective, customInstructions), stages, and enabled tools.',
  inputSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string', description: 'The MongoDB ID of the agent' }
    },
    required: ['agentId']
  }
}

export async function getAgentHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  const agentId = args.agentId as string
  return client.get(`/api/v1/mcp/agents/${agentId}`)
}
