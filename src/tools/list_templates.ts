import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'

export const LIST_TEMPLATES_TOOL: Tool = {
  name: 'list_templates',
  description: `List all available agent templates for quick agent creation.

Returns templates organized by industry vertical (beauty, clinic, restaurant, fitness, etc.).
Each template includes pre-configured stages, connections (graph flow), tools, and channel overrides.

Use create_from_template to create an agent from any template.`,
  inputSchema: {
    type: 'object',
    properties: {},
    required: []
  }
}

export async function listTemplatesHandler(client: BotuyoApiClient, _args: Record<string, unknown>) {
  return client.get('/api/v1/mcp/templates')
}
