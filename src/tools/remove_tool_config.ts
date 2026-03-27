import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'

export const REMOVE_TOOL_CONFIG_TOOL: Tool = {
  name: 'remove_tool_config',
  description: 'Elimina la configuración de un tool. Si es multi-instance, también la remueve de enabledTools automáticamente.',
  inputSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string', description: 'ID del agente' },
      toolName: { type: 'string', description: 'Nombre del tool o instancia a eliminar' }
    },
    required: ['agentId', 'toolName']
  }
}

export async function removeToolConfigHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  const { agentId, toolName } = args
  if (!agentId || !toolName) throw new Error('agentId and toolName are required')

  const result = await client.delete(`/api/v1/mcp/agents/${agentId}/tool-config/${toolName}`)
  return result
}
