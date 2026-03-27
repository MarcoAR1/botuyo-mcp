import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'

export const GET_TOOLS_CATALOG_TOOL: Tool = {
  name: 'get_tools_catalog',
  description: 'Lista el catálogo completo de tools disponibles con su metadata: configurable, allowMultiInstance, configSchema, requiredIntegrations.',
  inputSchema: {
    type: 'object',
    properties: {
      filter: { type: 'string', description: 'Filtro opcional: "configurable" (solo configurables), "multi" (solo multi-instance), o vacío para todas' }
    }
  }
}

export async function getToolsCatalogHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  const result = await client.get('/api/v1/mcp/tools/catalog')

  if (!result || !result.success) {
    throw new Error('Could not fetch tools catalog')
  }

  let tools: any[] = result.data || []
  const filter = args.filter as string | undefined

  if (filter === 'configurable') {
    tools = tools.filter((t: any) => t.configurable)
  } else if (filter === 'multi') {
    tools = tools.filter((t: any) => t.allowMultiInstance)
  }

  let output = `Catálogo de tools (${tools.length}):\n\n`

  for (const tool of tools) {
    const badges: string[] = []
    if (tool.configurable) badges.push('⚙️ configurable')
    if (tool.allowMultiInstance) badges.push('🔁 multi-instance')
    if (tool.requiresAuth) badges.push('🔒 auth')

    output += `  ${tool.name} ${badges.length > 0 ? `[${badges.join(', ')}]` : ''}\n`
    if (tool.description) {
      output += `    ${tool.description.slice(0, 120)}\n`
    }
    if (tool.configSchema && tool.configSchema.length > 0) {
      const keys = tool.configSchema.map((f: any) => `${f.key}(${f.type})`).join(', ')
      output += `    Config: ${keys}\n`
    }
    if (tool.requiredIntegrations) {
      output += `    Requiere: ${tool.requiredIntegrations.label || tool.requiredIntegrations.category}\n`
    }
    output += '\n'
  }

  return { text: output }
}
