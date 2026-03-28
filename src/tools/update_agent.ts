import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'

export const UPDATE_AGENT_TOOL: Tool = {
  name: 'update_agent',
  description: `Update an agent's identity configuration (tone, language, objective, custom instructions) and/or top-level name/description. 
  
Use this to configure WHO the agent is. For defining WHAT the agent does in each conversation flow, use upsert_stage.
For changing which tools the agent can call, use update_enabled_tools.

Requires role: owner, admin, or developer.`,
  inputSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string', description: 'The MongoDB ID of the agent' },
      name: { type: 'string', description: 'Agent display name' },
      description: { type: 'string', description: 'Agent description' },
      identity: {
        type: 'object',
        description: 'Identity configuration for the agent',
        properties: {
          tone: { type: 'string', description: 'Personality tone (e.g. "Cálida, experta, persuasiva con FOMO natural")' },
          language: { type: 'string', description: 'BCP-47 language code (e.g. "es-AR", "en-US", "pt-BR")' },
          objective: { type: 'string', description: 'Primary objective of the agent' },
          customInstructions: { type: 'string', description: 'Custom instructions that override default behavior. Supports markdown.' }
        }
      },
      channels: {
        type: 'array',
        items: { type: 'string' },
        description: 'Channels where this agent is active. Valid values: "web", "whatsapp", "telegram", "instagram", "discord", "phone"'
      }
    },
    required: ['agentId']
  }
}

export async function updateAgentHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  const { agentId, ...rest } = args
  return client.put(`/api/v1/mcp/agents/${agentId as string}`, rest)
}
