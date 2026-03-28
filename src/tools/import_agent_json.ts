import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

export const IMPORT_AGENT_JSON_TOOL: Tool = {
  name: 'import_agent_json',
  description: `Import/replace an agent's FULL configuration from a local JSON file or from a JSON object.

**This is a FULL REPLACE operation** — the entire agentConfig is overwritten with the provided config.
For partial updates (changing just one field), use update_agent instead.

**Null handling:**
- Fields set to null are stripped before saving (field is removed from the stored config)
- Omitted fields are NOT preserved — this is a full replace, not a merge
- Internal fields (model, temperature, summaryThreshold, voice.liveModel) are preserved automatically

**Preferred workflow:**
1. Use export_agent_json to save the agent config to a local file (auto-saved to ./agents/)
2. Edit the local file as needed
3. Use this tool with filePath pointing to that file to apply the changes

You can provide the config either via:
- filePath: path to a local JSON file (preferred — reads the file from disk)
- agentConfig: inline JSON object (fallback if no file)

If both are provided, filePath takes priority.

Requires role: owner, admin, or developer.`,
  inputSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string', description: 'The MongoDB ID of the agent to update. If not provided and filePath contains _agentId, that will be used.' },
      filePath: { type: 'string', description: 'Path to a local JSON file with the agent config (e.g. ./agents/mar.json). Preferred over inline agentConfig.' },
      agentConfig: {
        type: 'object',
        description: 'The full agentConfig object (fallback if filePath is not provided). Must include name and identity.',
        properties: {
          name: { type: 'string', description: 'Agent display name' },
          identity: {
            type: 'object',
            description: 'Agent identity (tone, language, objective, customInstructions)',
            properties: {
              tone: { type: 'string' },
              language: { type: 'string' },
              objective: { type: 'string' },
              customInstructions: { type: 'string' }
            }
          },
          stages: { type: 'array', items: { type: 'object' }, description: 'Array of stage objects with id, name, type, instruction' },
          connections: { type: 'array', items: { type: 'object' }, description: 'Array of connection edges: { id, from, to, type, condition? }' },
          channelFlows: { type: 'object', description: 'Per-channel flow overrides: { channelName: { connections: [...] } }' },
          enabledTools: { type: 'array', items: { type: 'string' }, description: 'Tool IDs to enable' },
          toolConfigs: { type: 'object', description: 'Per-tool pre-configuration. Keys are tool names. Single-instance: { params, instruction }. Multi-instance: { baseTool, params, fields, instruction }. Use configure_agent_tool for managing individual configs.' },
          channels: { type: 'array', items: { type: 'string' }, description: 'Channels: web, whatsapp, phone, etc.' },
          widgetConfig: {
            type: 'object',
            description: 'Widget appearance, theming, animations, and behavior config',
            properties: {
              cssVariables: {
                type: 'object',
                description: 'Light mode CSS custom properties. Keys: primary, primaryForeground, background, foreground, card, cardForeground, muted, mutedForeground, border, destructive, radius, windowBorderRadius, launcherBorderRadius, windowHeight, windowBottom, spacing1-8. Values: HSL WITHOUT hsl() wrapper (e.g. "210 100% 50%").'
              },
              darkCssVariables: {
                type: 'object',
                description: 'Dark mode overrides. Same keys as cssVariables. primary/primaryForeground are preserved from light mode — only override surface colors (background, card, muted, border, etc.).'
              },
              welcomeMessage: { type: 'string', description: 'Initial greeting shown when widget opens' },
              inputPlaceholder: { type: 'string', description: 'Placeholder text in chat input' },
              position: { type: 'string', enum: ['bottom-right', 'bottom-left'], description: 'Widget position' },
              theme: { type: 'string', enum: ['light', 'dark', 'auto'], description: 'Widget color scheme. "auto" follows host page prefers-color-scheme' },
              headerText: { type: 'string', description: 'Text shown in the widget header bar' },
              starterPrompt: { type: 'string', description: 'Bubble text shown when widget is closed to invite interaction' },
              defaultLocale: { type: 'string', enum: ['es', 'en', 'pt', 'fr'], description: 'Widget UI language' },
              avatarUrl: { type: 'string', description: '2D avatar image URL. Use upload_agent_media to upload and auto-assign' },
              logoUrl: { type: 'string', description: 'Widget logo URL. Use upload_agent_media with mediaType "logo"' },
              avatarScale: { type: 'number', description: 'Avatar zoom factor (default 1, e.g. 1.2 = 20% larger)' },
              showPromptAvatar: { type: 'boolean', description: 'Show mini avatar next to starter prompt bubble' },
              avatar3dUrl: { type: 'string', description: 'URL to .glb/.vrm 3D model for voice call avatar' },
              avatarAnimations: { type: 'object', description: 'Emotion → image URL mapping for animated avatar expressions' },
              avatar2dAnimations: { type: 'object', description: 'Animation state → image URL for 2D avatar animations' },
              animations: {
                type: 'object',
                description: 'Animation config',
                properties: {
                  enabled: { type: 'boolean', description: 'Master toggle for all animations' },
                  messageEntry: { type: 'string', enum: ['slide', 'fade', 'scale', 'spring', 'none'] },
                  typingIndicator: { type: 'string', enum: ['dots', 'wave', 'pulse', 'none'] },
                  buttonEffects: { type: 'boolean' },
                  smoothScroll: { type: 'boolean' },
                  windowTransitions: { type: 'boolean' },
                  launcherPulse: { type: 'boolean' },
                  speedMultiplier: { type: 'number', description: '0.5 = faster, 2 = slower, default 1' },
                  staggerDelay: { type: 'number', description: 'ms between sequential message animations, default 50' }
                }
              },
              effects: {
                type: 'object',
                description: 'Visual effects config',
                properties: {
                  glassmorphism: { type: 'boolean', description: 'Frosted glass blur on headers' },
                  gradients: { type: 'boolean', description: 'Gradient backgrounds on surfaces' },
                  softShadows: { type: 'boolean' },
                  glowEffects: { type: 'boolean', description: 'Glow effects on hover/focus' },
                  shimmerLoading: { type: 'boolean' },
                  hoverLift: { type: 'boolean', description: 'Lift effect on card hover' },
                  particles: { type: 'boolean', description: 'Confetti on actions (default false)' },
                  soundEffects: { type: 'boolean', description: 'UI sounds (default false)' },
                  hapticFeedback: { type: 'boolean', description: 'Mobile vibration (default true)' }
                }
              }
            }
          },
          voice: {
            type: 'object',
            description: 'Voice config. liveModel is admin-only and preserved.',
            properties: {
              profile: { type: 'string', description: 'Voice profile. Accepts display name, ID, or legacy Gemini name. Valid: "Profesional Femenina" (kore), "Amigable Femenina" (aoede), "Serena Femenina" (leda), "Energético Masculino" (puck), "Formal Masculino" (charon), "Cálido Masculino" (fenrir), "Neutro Profesional" (orus), "Suave Neutral" (zephyr).' },
              widgetCallEnabled: { type: 'boolean', description: 'Whether voice calls are enabled in the widget' }
            }
          },
          channelPrompts: { type: 'object', description: 'Per-channel system prompt overrides: { channelName: "prompt text" }' },
          knowledgeDocumentIds: { type: 'array', items: { type: 'string' }, description: 'Knowledge base document IDs for RAG' },
          allowedOrigins: { type: 'array', items: { type: 'string' }, description: 'CORS allowed origins for web widget embedding' }
        },
        required: ['name', 'identity']
      }
    },
    required: ['agentId']
  }
}

export async function importAgentJsonHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  let agentId = args.agentId as string | undefined
  let agentConfig = args.agentConfig as Record<string, unknown> | undefined

  // If filePath is provided, read the JSON from local filesystem
  const filePath = args.filePath as string | undefined
  if (filePath) {
    const resolvedPath = resolve(filePath)

    if (!existsSync(resolvedPath)) {
      return {
        success: false,
        error: `File not found: ${resolvedPath}`,
        hint: 'Use export_agent_json first to create a local file, or check the path.'
      }
    }

    try {
      const raw = readFileSync(resolvedPath, 'utf-8')
      const parsed = JSON.parse(raw)

      // Strip export metadata fields — they're informational only
      const { _exportedAt, _agentId, _apiKey, ...config } = parsed

      // Use _agentId from file if not explicitly provided
      if (!agentId && _agentId) {
        agentId = _agentId
      }

      agentConfig = config
    } catch (err: any) {
      return {
        success: false,
        error: `Failed to read/parse file: ${err.message}`,
        path: resolvedPath
      }
    }
  }

  if (!agentId) {
    return {
      success: false,
      error: 'agentId is required. Provide it explicitly or use a file exported with export_agent_json (contains _agentId).'
    }
  }

  if (!agentConfig) {
    return {
      success: false,
      error: 'No agent config provided. Use filePath to point to a local JSON file, or provide agentConfig inline.'
    }
  }

  const result = await client.put(`/api/v1/mcp/agents/${agentId}/import`, { agentConfig })

  return {
    ...(result as any),
    importedFrom: filePath ? resolve(filePath) : 'inline',
  }
}
