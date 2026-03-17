import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'

export const LIST_AGENTS_TOOL: Tool = {
  name: 'list_agents',
  description: 'Lists all agents for the authenticated tenant. Returns id, name, description, status (draft/published), and how many tools each agent has enabled.',
  inputSchema: { type: 'object', properties: {}, required: [] }
}

export async function listAgentsHandler(client: BotuyoApiClient, _args: Record<string, unknown>) {
  const res = await client.get('/api/v1/mcp/agents')
  return res
}
