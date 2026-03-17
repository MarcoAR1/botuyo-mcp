import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'

export const PUBLISH_AGENT_TOOL: Tool = {
  name: 'publish_agent',
  description: 'Publish or unpublish an agent. Published agents are live and handle incoming conversations. Unpublished agents are in "draft" status.\n\nRequires role: owner, admin, or developer.',
  inputSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string', description: 'The MongoDB ID of the agent' },
      publish: { type: 'boolean', description: 'true = publish (go live), false = unpublish (back to draft)' }
    },
    required: ['agentId', 'publish']
  }
}

export async function publishAgentHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  const { agentId, publish } = args
  return client.put(`/api/v1/mcp/agents/${agentId as string}/publish`, { publish })
}
