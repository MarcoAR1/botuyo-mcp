import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'

export const CONFIGURE_AGENT_TOOL: Tool = {
  name: 'configure_agent_tool',
  description: `Crea o actualiza la config de un tool para un agente. Si la tool no está en \`enabledTools\`, la agrega automáticamente.

Dos modos:
- **Single-instance**: configura una tool existente (ej. \`send_email\`) con params fijos.
- **Multi-instance**: crea una instancia virtual con nombre propio basada en una tool real (requiere \`baseTool\`). Ej: \`webhook_pedidos\` basada en \`call_webhook\`.`,
  inputSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string', description: 'ID del agente' },
      toolName: { type: 'string', description: 'Nombre del tool (existente para single-instance, o nombre custom para multi-instance)' },
      baseTool: { type: 'string', description: 'Tool base del registry (solo multi-instance). Ej: "call_webhook", "sync_to_google_sheets", "sync_to_hubspot"' },
      params: { type: 'object', description: 'Parámetros invisibles al LLM, inyectados en execute() (ej. fromEmail, url, spreadsheetId)' },
      fields: { 
        type: 'array', 
        items: { type: 'object' },
        description: 'Campos tipados que la IA ve (override del declaration). Array de {name, type, label, required, enumValues, validation}' 
      },
      instruction: { type: 'string', description: 'Guía de 1 línea para el LLM explicando qué hace esta tool/instancia' }
    },
    required: ['agentId', 'toolName']
  }
}

export async function configureAgentToolHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  const { agentId, toolName, baseTool, params, fields, instruction } = args as any

  if (!agentId || !toolName) {
    throw new Error('agentId and toolName are required')
  }

  const payload: Record<string, unknown> = {}
  if (baseTool !== undefined) payload.baseTool = baseTool
  if (params !== undefined) payload.params = params
  if (fields !== undefined) payload.fields = fields
  if (instruction !== undefined) payload.instruction = instruction

  const result = await client.put(`/api/v1/mcp/agents/${agentId}/tool-config/${toolName}`, payload)
  return result
}
