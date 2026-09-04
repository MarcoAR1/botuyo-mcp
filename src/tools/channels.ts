/**
 * Channel tools — connect/list/disconnect the tenant's messaging channels.
 *
 * SECURITY MODEL (read before editing):
 *  - Channel secrets (bot tokens, access tokens, app secrets…) are WRITE-ONLY: the server
 *    stores them and NEVER returns their values. `list_channels` only reports which credential
 *    keys are set (`credentialsSet`), never the values.
 *  - To keep secrets OUT of the AI assistant's context, `connect_channel` supports two modes:
 *      1. `credentials` — literal values (simplest; the secret travels through the chat/LLM).
 *      2. `credentialsFromEnv` — a map of `{ credentialKey: ENV_VAR_NAME }`; the MCP server reads
 *         the value from its OWN environment (process.env) and the secret never appears in the
 *         conversation. PREFER this for production secrets.
 *  - Connecting/disconnecting requires role owner or admin (enforced server-side too).
 *
 * All calls go through the /api/v1/mcp/channels namespace (RULE 7).
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'

const BASE = '/api/v1/mcp/channels'

export const LIST_CHANNELS_TOOL: Tool = {
  name: 'list_channels',
  description:
    'List the tenant\'s messaging channels (WhatsApp, Telegram, Discord, Web, Instagram…) with their ' +
    'connection status. SECRETS ARE NEVER RETURNED — each channel reports only `credentialsSet` (which ' +
    'secret keys are configured), never their values. Available to any authenticated role.',
  inputSchema: { type: 'object', properties: {} }
}

export const CONNECT_CHANNEL_TOOL: Tool = {
  name: 'connect_channel',
  description:
    'Connect a messaging channel to the tenant with its secret credentials (bot token, access token, etc.). ' +
    'Requires role owner or admin. The server validates the credential against the provider API and stores ' +
    'it server-side; the secret is WRITE-ONLY and is never echoed back — DO NOT repeat the secret to the user. ' +
    '\n\nTwo ways to pass the secret:\n' +
    '• `credentials`: literal values, e.g. { "botToken": "123:ABC" }. Simplest, but the secret passes through ' +
    'this conversation.\n' +
    '• `credentialsFromEnv` (RECOMMENDED for real secrets): a map of credential key → environment variable ' +
    'name, e.g. { "botToken": "MY_TG_TOKEN" }. The MCP server reads the value from its own environment so the ' +
    'secret NEVER appears in the chat. Set that env var in your MCP client config.\n\n' +
    'Typical per channel: telegram → credentials.botToken; whatsapp → credentials.accessToken + ' +
    'config.phoneNumberId; discord → credentials.botToken; web → no secret. Fields from both sources are merged.',
  inputSchema: {
    type: 'object',
    properties: {
      channelType: {
        type: 'string',
        enum: ['whatsapp', 'telegram', 'discord', 'web', 'webchat', 'instagram', 'facebook'],
        description: 'Channel to connect.'
      },
      config: {
        type: 'object',
        description: 'Non-secret settings (e.g. { "phoneNumberId": "..." } for WhatsApp).',
        additionalProperties: true
      },
      credentials: {
        type: 'object',
        description: 'Secret values as literals (e.g. { "botToken": "..." }). Prefer credentialsFromEnv for real secrets.',
        additionalProperties: true
      },
      credentialsFromEnv: {
        type: 'object',
        description:
          'Map of credential key → env var name read from the MCP server environment (keeps the secret out of the chat). ' +
          'e.g. { "botToken": "MY_TG_TOKEN" }.',
        additionalProperties: { type: 'string' }
      }
    },
    required: ['channelType']
  }
}

export const DISCONNECT_CHANNEL_TOOL: Tool = {
  name: 'disconnect_channel',
  description:
    'Disconnect a channel by its id (archives its open conversations). Use list_channels first to get the id. ' +
    'Requires role owner or admin.',
  inputSchema: {
    type: 'object',
    properties: { channelId: { type: 'string', description: 'The channel id (from list_channels).' } },
    required: ['channelId']
  }
}

export async function listChannelsHandler(client: BotuyoApiClient): Promise<unknown> {
  return client.get(BASE)
}

export async function connectChannelHandler(
  client: BotuyoApiClient,
  args: Record<string, unknown>
): Promise<unknown> {
  const channelType = args.channelType as string
  if (!channelType) throw new Error('channelType is required')

  const config = (args.config as Record<string, unknown>) || {}
  const credentials: Record<string, unknown> = { ...((args.credentials as Record<string, unknown>) || {}) }

  // Resolve credentialsFromEnv against the MCP server's own environment so secrets stay out of the chat.
  const fromEnv = args.credentialsFromEnv as Record<string, string> | undefined
  if (fromEnv) {
    for (const [key, envName] of Object.entries(fromEnv)) {
      const value = process.env[envName]
      if (value === undefined || value === '') {
        throw new Error(
          `Environment variable "${envName}" (for credential "${key}") is not set in the MCP server environment. ` +
            `Add it to your MCP client config or use the literal "credentials" field.`
        )
      }
      credentials[key] = value
    }
  }

  return client.post(`${BASE}/connect`, { channelType, config, credentials })
}

export async function disconnectChannelHandler(
  client: BotuyoApiClient,
  args: Record<string, unknown>
): Promise<unknown> {
  const channelId = args.channelId as string
  if (!channelId) throw new Error('channelId is required')
  return client.delete(`${BASE}/${channelId}`)
}
