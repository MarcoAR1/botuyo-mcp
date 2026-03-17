import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'

export const LIST_TOOLS_TOOL: Tool = {
  name: 'list_available_tools',
  description: 'List all tools available for this tenant. Returns both "core" tools (available to all tenants) and "tenant" tools (custom tools specific to your tenant). Use tool IDs when enabling tools with update_enabled_tools or configuring stage tools.',
  inputSchema: { type: 'object', properties: {}, required: [] }
}

export async function listToolsHandler(client: BotuyoApiClient, _args: Record<string, unknown>) {
  return client.get('/api/v1/mcp/tools')
}
