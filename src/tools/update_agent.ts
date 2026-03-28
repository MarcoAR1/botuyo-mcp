import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'

export const UPDATE_AGENT_TOOL: Tool = {
  name: 'update_agent',
  description: `Update an agent's configuration with partial merge. Only the fields you provide are changed — everything else is preserved.

**Field behavior:**
- **Omitted field** → not touched (keeps existing value)
- **Field with value** → sets/overwrites that field
- **Field set to null** → deletes that field from the agent config

**Nested objects** (identity, widgetConfig, voice, widgetConfig.cssVariables) are deep-merged:
  update_agent({ widgetConfig: { logoUrl: "https://..." } })
  → only logoUrl changes, all other widgetConfig fields preserved

**Arrays** (channels, enabledTools) are replaced entirely:
  update_agent({ channels: ["web", "whatsapp"] })
  → replaces the full channels array

Use this to configure WHO the agent is and HOW it looks.
For defining WHAT the agent does in each conversation flow, use upsert_stage.
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
        description: 'Identity configuration for the agent (deep-merged)',
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
        description: 'Channels where this agent is active (replaces entire array). Valid: "web", "whatsapp", "telegram", "instagram", "discord", "phone"'
      },
      widgetConfig: {
        type: 'object',
        description: `Widget appearance and behavior (deep-merged). Set any field to null to remove it.
Common fields: welcomeMessage, placeholder, headerText, starterPrompt, position ("bottom-right"/"bottom-left"),
defaultLocale ("es"/"en"/"pt"/"fr"), avatarUrl, logoUrl, avatarScale, showPromptAvatar,
avatar3dUrl, cssVariables (object), darkCssVariables (object), animations (object), effects (object).`,
        properties: {
          welcomeMessage: { type: 'string' },
          placeholder: { type: 'string' },
          headerText: { type: 'string' },
          starterPrompt: { type: 'string' },
          position: { type: 'string', enum: ['bottom-right', 'bottom-left'] },
          defaultLocale: { type: 'string', enum: ['es', 'en', 'pt', 'fr'] },
          avatarUrl: { type: 'string' },
          logoUrl: { type: 'string' },
          avatarScale: { type: 'number' },
          showPromptAvatar: { type: 'boolean' },
          avatar3dUrl: { type: 'string' },
          cssVariables: { type: 'object', description: 'Light mode CSS custom properties (deep-merged). Values: HSL without hsl() wrapper.' },
          darkCssVariables: { type: 'object', description: 'Dark mode overrides (deep-merged).' },
          animations: { type: 'object' },
          effects: { type: 'object' }
        }
      },
      voice: {
        type: 'object',
        description: 'Voice configuration (deep-merged). liveModel is admin-only and preserved automatically.',
        properties: {
          profile: { type: 'string', description: 'Voice profile name or ID. Valid: "Profesional Femenina" (kore), "Amigable Femenina" (aoede), "Serena Femenina" (leda), "Energético Masculino" (puck), "Formal Masculino" (charon), "Cálido Masculino" (fenrir)' },
          widgetCallEnabled: { type: 'boolean', description: 'Whether voice calls are enabled in the widget' }
        }
      },
      channelPrompts: {
        type: 'object',
        description: 'Per-channel system prompt overrides. Key = channel name, value = prompt text. Example: { "whatsapp": "Sé concisa, mensajes cortos" }'
      }
    },
    required: ['agentId']
  }
}

export async function updateAgentHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  const { agentId, ...rest } = args
  return client.put(`/api/v1/mcp/agents/${agentId as string}`, rest)
}
