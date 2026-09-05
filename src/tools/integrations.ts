/**
 * Integration tools — install/list/remove the tenant's external integrations (Shopify, PaseoLibre,
 * Google Calendar, email SMTP, etc.) with their secret config.
 *
 * SECURITY MODEL (same as channels):
 *  - Secret config values are WRITE-ONLY: the server validates + stores them and NEVER returns
 *    them. `list_integrations` reports only `configKeys` (which keys are set), never values.
 *  - `configure_integration` accepts the secret two ways:
 *      1. `config` — literal values (simplest; the secret travels through the chat/LLM).
 *      2. `configFromEnv` — a map of `{ configKey: ENV_VAR_NAME }`; the MCP server reads the value
 *         from its OWN environment so the secret never appears in the conversation. PREFER this.
 *  - Configure/remove require role owner or admin.
 *
 * All calls go through the /api/v1/mcp/integrations namespace (RULE 7).
 *
 * NOTE (RULE 0): these are agent/tenant integrations. Recruiting-owned config (e.g. recruiting
 * email senders) is NOT managed here — that belongs to the Recruiting copiloto.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'

const BASE = '/api/v1/mcp/integrations'

export const LIST_INTEGRATIONS_TOOL: Tool = {
  name: 'list_integrations',
  description:
    'List the integration catalog (available) and the tenant\'s installed integrations with their ' +
    'status. SECRETS ARE NEVER RETURNED — each installed integration reports only `configKeys` ' +
    '(which config keys are set), never their values. Available to any authenticated role.',
  inputSchema: { type: 'object', properties: {} }
}

export const CONFIGURE_INTEGRATION_TOOL: Tool = {
  name: 'configure_integration',
  description:
    'Install or update a tenant integration with its config/secret (API key, tokens, SMTP creds, etc.). ' +
    'Requires role owner or admin. The server validates the credentials against the provider and stores ' +
    'them; secrets are WRITE-ONLY and never echoed back — DO NOT repeat them to the user. ' +
    '\n\nTwo ways to pass secret values:\n' +
    '• `config`: literal values, e.g. { "apiKey": "sk-..." }. Simplest, but the secret passes through this chat.\n' +
    '• `configFromEnv` (RECOMMENDED for real secrets): a map of config key → environment variable name, ' +
    'e.g. { "apiKey": "MY_SHOPIFY_KEY" }. The MCP server reads the value from its own environment so the ' +
    'secret NEVER appears in the chat. Both sources are merged. Use `list_integrations` to see available ids.',
  inputSchema: {
    type: 'object',
    properties: {
      integrationId: { type: 'string', description: 'Integration id from the catalog (e.g. "shopify", "email-smtp").' },
      config: {
        type: 'object',
        description: 'Config/secret values as literals (e.g. { "apiUrl": "...", "apiKey": "..." }).',
        additionalProperties: true
      },
      configFromEnv: {
        type: 'object',
        description:
          'Map of config key → env var name read from the MCP server environment (keeps the secret out of the chat).',
        additionalProperties: { type: 'string' }
      }
    },
    required: ['integrationId']
  }
}

export const REMOVE_INTEGRATION_TOOL: Tool = {
  name: 'remove_integration',
  description:
    'Uninstall a tenant integration by its id (from list_integrations). Requires role owner or admin.',
  inputSchema: {
    type: 'object',
    properties: { integrationId: { type: 'string', description: 'The integration id to remove.' } },
    required: ['integrationId']
  }
}

export async function listIntegrationsHandler(client: BotuyoApiClient): Promise<unknown> {
  return client.get(BASE)
}

export async function configureIntegrationHandler(
  client: BotuyoApiClient,
  args: Record<string, unknown>
): Promise<unknown> {
  const integrationId = args.integrationId as string
  if (!integrationId) throw new Error('integrationId is required')

  const config: Record<string, unknown> = { ...((args.config as Record<string, unknown>) || {}) }

  const fromEnv = args.configFromEnv as Record<string, string> | undefined
  if (fromEnv) {
    for (const [key, envName] of Object.entries(fromEnv)) {
      const value = process.env[envName]
      if (value === undefined || value === '') {
        throw new Error(
          `Environment variable "${envName}" (for config "${key}") is not set in the MCP server environment. ` +
            `Add it to your MCP client config or use the literal "config" field.`
        )
      }
      config[key] = value
    }
  }

  return client.post(`${BASE}/configure`, { integrationId, config })
}

export async function removeIntegrationHandler(
  client: BotuyoApiClient,
  args: Record<string, unknown>
): Promise<unknown> {
  const integrationId = args.integrationId as string
  if (!integrationId) throw new Error('integrationId is required')
  return client.delete(`${BASE}/${integrationId}`)
}
