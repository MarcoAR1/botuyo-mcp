import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'

export const UPDATE_ENABLED_TOOLS_TOOL: Tool = {
  name: 'update_enabled_tools',
  description: `Set which tools are enabled for an agent. This REPLACES the current list of enabled tools.

Use list_available_tools to see the valid tool IDs for your tenant first.

Requires role: owner, admin, or developer.`,
  inputSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string', description: 'The MongoDB ID of the agent' },
      toolIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of tool IDs to enable (replaces current list). Get valid IDs from list_available_tools.'
      }
    },
    required: ['agentId', 'toolIds']
  }
}

export async function updateEnabledToolsHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  const { agentId, toolIds } = args
  return client.put(`/api/v1/mcp/agents/${agentId as string}`, {
    enabledTools: toolIds
  })
}
