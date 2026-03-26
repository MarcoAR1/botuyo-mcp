import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'

export const LIST_BASE_TOOLS_TOOL: Tool = {
  name: 'list_base_tools',
  description: 'Lista los base tools disponibles para crear factories y los connectors que soportan.',
  inputSchema: {
    type: 'object',
    properties: {}
  }
}

export async function listBaseToolsHandler(client: BotuyoApiClient, _args: Record<string, unknown>) {
  const result = await client.get('/api/v1/mcp/tools/base')
  
  if (result && result.success && result.data) {
    let output = 'Base tools disponibles para factory:\n\n'
    const baseTools = result.data

    for (const [baseToolName, info] of Object.entries(baseTools)) {
      const tl = info as any
      output += `  ${baseToolName}\n`
      if (tl.connectors && tl.connectors.length > 0) {
        output += `    Connectors: ${tl.connectors.join(', ')}\n`
      } else {
        output += `    Connectors: —\n`
      }
      if (tl.description) {
        output += `    Descripción: ${tl.description}\n`
      }
      output += '\n'
    }
    return { text: output }
  }

  return result
}
