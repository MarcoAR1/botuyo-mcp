import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'

export const GET_TOOL_CONFIG_TOOL: Tool = {
  name: 'get_tool_config',
  description: 'Ver el config completo de un tool (formato JSON).',
  inputSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string' },
      toolName: { type: 'string' }
    },
    required: ['agentId', 'toolName']
  }
}

export async function getToolConfigHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  const { agentId, toolName } = args
  if (!agentId || !toolName) throw new Error('agentId and toolName are required')

  const result = await client.get(`/api/v1/mcp/agents/${agentId}/tools/${toolName}/config`)
  return result
}
