import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'

export const CONFIGURE_AGENT_TOOL: Tool = {
  name: 'configure_agent_tool',
  description: `Crea o actualiza la config de un tool para un agente. Si la tool no está en \`enabledTools\`, la agrega automáticamente.
  
Usa esta herramienta para configurar tools nativas (ej. \`send_email\`) o para crear tool factories (instancias virtuales de tools base como \`sync_document\`).`,
  inputSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string', description: 'ID del agente' },
      toolName: { type: 'string', description: 'Nombre del tool (existente o nombre nuevo para factory)' },
      baseTool: { type: 'string', description: 'Tool base para crear una factory (ej. "sync_document", "call_webhook")' },
      connector: { type: 'string', description: 'Conector a usar si es factory (ej. "google_sheets", "notion")' },
      params: { type: 'object', description: 'Parámetros invisibles al LLM (ej. templateId, spreadsheetId)' },
      fields: { 
        type: 'array', 
        items: { type: 'object' },
        description: 'Campos tipados (override del declaration). Array de IToolField con name, type, label, required, enumValues, validation, etc.' 
      },
      instruction: { type: 'string', description: 'Guía para el LLM (1 línea explicando qué hace esta tool específica)' }
    },
    required: ['agentId', 'toolName']
  }
}

export async function configureAgentToolHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  const { agentId, toolName, baseTool, connector, params, fields, instruction } = args as any

  if (!agentId || !toolName) {
    throw new Error('agentId and toolName are required')
  }

  const payload = {
    toolName,
    baseTool,
    connector,
    params,
    fields,
    instruction
  }

  // Se asume endpoint: PUT /api/v1/mcp/agents/:agentId/tools/config
  const result = await client.put(`/api/v1/mcp/agents/${agentId}/tools/config`, payload)
  return result
}
