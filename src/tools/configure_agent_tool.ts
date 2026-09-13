import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'
import { toolConfigSchema } from '../schemas/toolConfig.js'
import { assertToolInput } from '../toolProtocol.js'

export const CONFIGURE_AGENT_TOOL: Tool = {
  name: 'configure_agent_tool',
  description: `Configura una tool existente o una instancia virtual; no crea código ejecutable. Consultar get_tools_catalog antes y get_tool_contract después. Si falta en enabledTools, se agrega. stageIds asocia etapas existentes; sin etapas visibles la tool puede quedar indisponible. mode=patch conserva campos omitidos y combina params por clave; mode=replace (predeterminado por compatibilidad) reemplaza la entrada completa. expectedUpdatedAt permite rechazar ediciones obsoletas. Usar get_tool_config para obtenerlo.

Dos modos:
- **Single-instance**: configura una tool existente (ej. \`send_email\`) con params fijos.
- **Multi-instance**: crea una instancia virtual con nombre propio basada en una tool real (requiere \`baseTool\`). Ej: \`webhook_pedidos\` basada en \`call_webhook\`.`,
  inputSchema: {
    type: 'object',
    properties: {
      ...toolConfigSchema.properties,
      agentId: { type: 'string', description: 'ID del agente' },
      toolName: { type: 'string', description: 'Nombre del tool (existente para single-instance, o nombre custom para multi-instance)' },
      baseTool: { type: 'string', description: 'Tool base del registry (solo multi-instance). Ej: "call_webhook", "sync_to_google_sheets", "sync_to_hubspot"' },
      params: { type: 'object', description: 'Parámetros invisibles al LLM, inyectados en execute() (ej. fromEmail, url, spreadsheetId)' },
      fields: toolConfigSchema.properties.fields,
      mode: { type: 'string', enum: ['replace', 'patch'], description: 'replace reemplaza la entrada; patch preserva propiedades omitidas y combina params por clave.' },
      expectedUpdatedAt: { type: 'string', format: 'date-time', description: 'updatedAt obtenido al leer; una edición concurrente devuelve conflicto.' },
      stageIds: { type: 'array', uniqueItems: true, items: { type: 'string' }, description: 'Etapas existentes a las que agregar esta tool.' },
      instruction: { type: 'string', description: 'Guía de 1 línea para el LLM explicando qué hace esta tool/instancia' }
    },
    required: ['agentId', 'toolName'], additionalProperties: false
  },
  outputSchema: { type: 'object', required: ['success'], properties: { success: { type: 'boolean' }, error: { type: 'string' }, updatedAt: { type: 'string' } } }
}

export async function configureAgentToolHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  const { agentId, toolName, baseTool, params, fields, instruction } = args as any

  if (!agentId || !toolName) {
    throw new Error('agentId and toolName are required')
  }
  assertToolInput(CONFIGURE_AGENT_TOOL, args)

  const payload: Record<string, unknown> = {}
  if (baseTool !== undefined) payload.baseTool = baseTool
  if (params !== undefined) payload.params = params
  if (fields !== undefined) payload.fields = fields
  if (instruction !== undefined) payload.instruction = instruction
  for (const key of ['connector', 'mode', 'expectedUpdatedAt', 'stageIds']) if (args[key] !== undefined) payload[key] = args[key]

  const result = await client.put(`/api/v1/mcp/agents/${agentId}/tool-config/${toolName}`, payload)
  return result
}
