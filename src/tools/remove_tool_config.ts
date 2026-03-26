import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'

export const REMOVE_TOOL_CONFIG_TOOL: Tool = {
  name: 'remove_tool_config',
  description: 'Elimina la configuración de un tool. Si es factory, también la remueve de enabledTools por defecto.',
  inputSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string' },
      toolName: { type: 'string' },
      removeFromEnabled: { type: 'boolean', description: 'default: true para factory, false para native' }
    },
    required: ['agentId', 'toolName']
  }
}

export async function removeToolConfigHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  const { agentId, toolName, removeFromEnabled } = args
  if (!agentId || !toolName) throw new Error('agentId and toolName are required')

  const query = removeFromEnabled !== undefined ? `?removeFromEnabled=${removeFromEnabled}` : ''
  const result = await client.delete(`/api/v1/mcp/agents/${agentId}/tools/${toolName}/config${query}`)
  
  return result
}
