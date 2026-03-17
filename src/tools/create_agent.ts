import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'

export const CREATE_AGENT_TOOL: Tool = {
  name: 'create_agent',
  description: 'Create a new agent for the tenant. The agent is created in "draft" status. Use update_agent to configure identity, stages, and tools afterward. Requires role: owner, admin, or developer.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Display name of the agent (e.g. "Mar 🌊")' },
      description: { type: 'string', description: 'Brief description of what this agent does' },
      type: { type: 'string', description: 'Agent type. Use "agent" (default)', enum: ['agent'] }
    },
    required: ['name']
  }
}

export async function createAgentHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  return client.post('/api/v1/mcp/agents', {
    name: args.name,
    description: args.description || '',
    type: args.type || 'agent'
  })
}
