import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'

export const LIST_TOOL_CONFIGS_TOOL: Tool = {
  name: 'list_tool_configs',
  description: 'Lista las configs de tools de un agente agrupadas: configuradas (single y multi-instance), habilitadas sin config, y resumen de multi-instance.',
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

  const result = await client.get(`/api/v1/mcp/agents/${agentId}/tool-configs`)
  if (!result || !result.success || !result.data) {
    throw new Error('Could not fetch tool configs')
  }

  const { configured, enabledWithoutConfig, multiInstanceSummary } = result.data

  let output = `Tool configs del agente ${agentId}:\n\n`

  // Configured tools
  output += `  Tools configuradas (${(configured || []).length}):\n`
  if (!configured || configured.length === 0) {
    output += `    (Ninguna)\n`
  } else {
    for (const tc of configured) {
      const mode = tc.mode === 'multi-instance' ? `[multi-instance: ${tc.baseTool}]` : '[single]'
      output += `    • ${tc.toolName} ${mode}\n`
      if (tc.params) {
        output += `      └ params: ${Object.keys(tc.params).join(', ')}\n`
      }
      if (tc.fieldsCount) {
        output += `      └ fields: ${tc.fieldsCount} campos\n`
      }
      if (tc.instruction) {
        output += `      └ instruction: "${tc.instruction}"\n`
      }
    }
  }

  // Enabled without config
  output += `\n  Tools habilitadas sin config (${(enabledWithoutConfig || []).length}):\n`
  if (!enabledWithoutConfig || enabledWithoutConfig.length === 0) {
    output += `    (Ninguna)\n`
  } else {
    for (const t of enabledWithoutConfig) {
      output += `    • ${t}\n`
    }
  }

  // Multi-instance summary
  if (multiInstanceSummary && Object.keys(multiInstanceSummary).length > 0) {
    output += `\n  Instancias multi-instance:\n`
    for (const [baseTool, instances] of Object.entries(multiInstanceSummary)) {
      output += `    ${baseTool}: ${(instances as string[]).join(', ')}\n`
    }
  }

  return { text: output }
}
