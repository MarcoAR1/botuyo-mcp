import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'

export const LIST_TOOL_CONFIGS_TOOL: Tool = {
  name: 'list_tool_configs',
  description: 'Lista las configs de tools de un agente, separando tools nativas y configuradas/factories.',
  inputSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string', description: 'ID del agente' }
    },
    required: ['agentId']
  }
}

export async function listToolConfigsHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  const agentId = args.agentId as string
  if (!agentId) throw new Error('agentId is required')

  // Obtener el agente para leer su toolConfigs y enabledTools
  const result = await client.get(`/api/v1/mcp/agents/${agentId}`)
  if (!result || !result.success || !result.data) {
    throw new Error('Could not fetch agent configuration')
  }

  const agent = result.data
  const enabledTools: string[] = agent.enabledTools || []
  const toolConfigs: Record<string, any> = agent.toolConfigs || {}

  const configuredTools = Object.keys(toolConfigs)
  const nativeTools = enabledTools.filter(t => !configuredTools.includes(t))

  let output = `Tools del agente "${agent.name || agentId}":\n\n`

  output += `  Tools nativas (sin config):\n`
  if (nativeTools.length === 0) {
    output += `    (Ninguna)\n`
  } else {
    nativeTools.forEach(t => {
      output += `    • ${t}\n`
    })
  }

  output += `\n  Tools configuradas:\n`
  if (configuredTools.length === 0) {
    output += `    (Ninguna)\n`
  } else {
    configuredTools.forEach(toolName => {
      const config = toolConfigs[toolName]
      const isFactory = config.baseTool ? `[factory: ${config.baseTool}${config.connector ? ` → ${config.connector}` : ''}]` : ''
      output += `    • ${toolName} ${isFactory}\n`
      
      if (config.params) {
        output += `      └ params: ${Object.keys(config.params).join(', ')}\n`
      }
      if (config.fields && Array.isArray(config.fields)) {
        const fieldSummaries = config.fields.map((f: any) => `${f.name} (${f.type})`).join(', ')
        output += `      └ fields: ${fieldSummaries} — ${config.fields.length} campos\n`
      }
      if (config.instruction) {
        output += `      └ instruction: "${config.instruction}"\n`
      }
    })
  }

  return { text: output }
}
