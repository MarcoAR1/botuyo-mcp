import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'
import { voiceProfileHelp } from '../format.js'

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
          profile: { type: 'string', description: `Voice profile name or ID. Valid: ${voiceProfileHelp()}` },
          widgetCallEnabled: { type: 'boolean', description: 'Whether voice calls are enabled in the widget' }
        }
      },
      channelPrompts: {
        type: 'object',
        description: 'Per-channel system prompt overrides. Key = channel name, value = prompt text. Example: { "whatsapp": "Sé concisa, mensajes cortos" }'
      },
      requiresUserIdentity: {
        type: 'boolean',
        description: 'SECURITY: whether this agent requires a verified per-user identity. On the web widget, when true you MUST also set endUserAuth — the widget then verifies the end-user token against it (the old anonymous reject becomes a verify). On identity-bearing channels (e.g. Telegram) the channel identity is used. Without endUserAuth, the agent is rejected on the anonymous web widget channel. Default false. Enable it for agents that read/write per-user data.'
      },
      endUserAuth: {
        type: 'object',
        description: 'SECURITY: how BotUyo verifies the authenticated end-user for this agent (only used when requiresUserIdentity is true). mode "jwt" verifies the token locally (jwksUrl preferred — zero shared secret; or publicKey; or sharedSecret HS256). mode "callback" delegates verification to YOUR https endpoint (RFC 7662-style introspection; BotUyo signs the request, verifiable via BotUyo\'s public JWKS — no shared secret). The sharedSecret is WRITE-ONLY — it is never returned by get/export (you will see "sharedSecretSet": true instead). Same shape as the import_agent_json agentConfig.endUserAuth.',
        properties: {
          mode: { type: 'string', enum: ['jwt', 'callback'], description: 'Verification mode: "jwt" (verify the token locally) or "callback" (delegate to your https endpoint).' },
          jwksUrl: { type: 'string', description: 'Preferred (RS256/ES256 with key rotation): the issuer JWKS endpoint URL.' },
          publicKey: { type: 'string', description: 'Static PEM public key for RS256/ES256 (alternative to jwksUrl).' },
          sharedSecret: { type: 'string', description: 'HS256 shared secret (least preferred). Write-only: never returned on get/export.' },
          issuer: { type: 'string', description: 'Expected "iss" claim. Also used to namespace the verified userId so ids never collide across IdPs/channels.' },
          audience: { type: 'string', description: 'Expected "aud" claim.' },
          callbackUrl: { type: 'string', description: 'mode "callback": YOUR https endpoint that validates the token and returns { active|valid, userId|sub, name?, email?, role?, claims? }. Must be https + a public host (anti-SSRF).' },
          callbackCacheTtlSeconds: { type: 'number', description: 'mode "callback": cache TTL in seconds for a verified result (default 60).' },
          claims: {
            type: 'object',
            description: 'Maps your token claim names. userId MUST be a stable, non-reassignable claim (recommend "sub"); never use email/username.',
            properties: {
              userId: { type: 'string', description: 'Claim holding the stable user id (default "sub").' },
              name: { type: 'string', description: 'Claim holding the display name.' },
              email: { type: 'string', description: 'Claim holding the email.' },
              role: { type: 'string', description: 'Claim holding the role (used for owner/member tool gating).' }
            }
          }
        }
      }
    },
    required: ['agentId']
  }
}

export async function updateAgentHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  const { agentId, ...rest } = args
  return client.put(`/api/v1/mcp/agents/${agentId as string}`, rest)
}
