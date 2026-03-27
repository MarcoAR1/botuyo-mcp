import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'

export const GET_TOOL_CONFIG_TOOL: Tool = {
  name: 'get_tool_config',
  description: 'Ver el config completo de un tool específico de un agente (formato JSON).',
  inputSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string', description: 'ID del agente' },
      toolName: { type: 'string', description: 'Nombre del tool o instancia' }
    },
    required: ['agentId', 'toolName']
  }
}

export async function getToolConfigHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  const { agentId, toolName } = args
  if (!agentId || !toolName) throw new Error('agentId and toolName are required')

  const result = await client.get(`/api/v1/mcp/agents/${agentId}/tool-configs`)
  if (!result || !result.success || !result.data) {
    throw new Error('Could not fetch tool configs')
  }

  const configured: any[] = result.data.configured || []
  const match = configured.find((tc: any) => tc.toolName === toolName)

  if (!match) {
    return { text: `Tool "${toolName}" no tiene configuración en este agente.` }
  }

  return match
}
