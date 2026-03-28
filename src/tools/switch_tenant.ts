import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'
import { readCredentials, saveCredentials } from '../commands/credentials.js'

export const SWITCH_TENANT_TOOL: Tool = {
  name: 'switch_tenant',
  description:
    'Switch the active tenant for this MCP session. ' +
    'If no tenantId is provided, lists all available tenants for the user. ' +
    'If a tenantId is provided, switches to that tenant. ' +
    'The switch takes effect immediately for subsequent tool calls.',
  inputSchema: {
    type: 'object',
    properties: {
      tenantId: {
        type: 'string',
        description: 'The tenant ID to switch to. Omit to list available tenants.'
      }
    },
    required: []
  }
}

const API_URL = process.env.BOTUYO_API_URL || 'https://api.botuyo.com'

/**
 * Resolve tenant name from API response.
 * Handles multiple response shapes: { name }, { data: { name } }, { data: { tenant: { name } } }
 */
function extractTenantName(responseData: any, fallback: string): string {
  if (!responseData) return fallback
  // Direct: { name: "..." }
  if (responseData.name && responseData.name !== responseData.tenantId) return responseData.name
  // Wrapped: { data: { name: "..." } }
  if (responseData.data?.name) return responseData.data.name
  // Nested: { data: { tenant: { name: "..." } } }
  if (responseData.data?.tenant?.name) return responseData.data.tenant.name
  return fallback
}

export async function switchTenantHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  const creds = await readCredentials()
  if (!creds?.token) {
    return { success: false, error: 'No credentials found. Run: npx @botuyo/mcp auth (browser) or npx @botuyo/mcp login (terminal)' }
  }

  // Get user info with tenants
  const meRes = await client.get<any>('/api/auth/me')
  const user = meRes.data?.user
  if (!user) {
    return { success: false, error: 'Could not retrieve user info.' }
  }

  const tenantIds: string[] = user.tenantIds || []
  const roles: Array<{ tenantId: string; role: string }> = user.roles || []

  // If no tenantId provided, list available tenants with names
  if (!args.tenantId) {
    const tenants = await Promise.all(tenantIds.map(async (tid: string) => {
      const role = roles.find((r) => r.tenantId === tid)?.role || 'member'
      const isActive = tid === creds.tenantId
      let name = isActive ? (creds.tenantName || tid) : tid

      // Try to resolve tenant name via API
      if (!isActive || name === tid) {
        try {
          const tRes = await client.get<any>(`/api/tenants/${tid}`)
          name = extractTenantName(tRes, tid)
        } catch { /* keep tid */ }
      }

      return { tenantId: tid, name, role, isActive }
    }))

    return {
      success: true,
      activeTenantId: creds.tenantId,
      activeTenantName: creds.tenantName,
      tenants,
      hint: 'Call switch_tenant with a tenantId to switch.'
    }
  }

  // Switch to the specified tenant
  const targetTenantId = args.tenantId as string

  if (!tenantIds.includes(targetTenantId)) {
    return {
      success: false,
      error: `Tenant ${targetTenantId} not found in your tenant list.`,
      availableTenants: tenantIds
    }
  }

  if (targetTenantId === creds.tenantId) {
    return { success: true, message: 'Already on that tenant. No change needed.' }
  }

  // Call switch-tenant API
  const switchRes = await client.post<any>('/api/auth/switch-tenant', { tenantId: targetTenantId })

  if (!switchRes.success) {
    return { success: false, error: switchRes.error || 'Failed to switch tenant.' }
  }

  const newToken = switchRes.data.token
  const newRole = switchRes.data.user?.role || roles.find((r) => r.tenantId === targetTenantId)?.role || 'member'

  // Try to get tenant name using the new token
  let tenantName = targetTenantId
  try {
    const tenantRes = await fetch(`${API_URL}/api/tenants/${targetTenantId}`, {
      headers: { Authorization: `Bearer ${newToken}` }
    })
    const tenantData = (await tenantRes.json()) as any
    tenantName = extractTenantName(tenantData, targetTenantId)
  } catch {
    // use tenantId as name
  }

  // Save new credentials
  await saveCredentials({
    ...creds,
    token: newToken,
    tenantId: targetTenantId,
    tenantName,
    role: newRole,
    savedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  })

  // Hot-swap the token in the running client so it takes effect immediately
  client.setToken(newToken)

  return {
    success: true,
    message: `Switched to tenant "${tenantName}" (${newRole}). The new tenant is now active.`,
    tenantId: targetTenantId,
    tenantName,
    role: newRole
  }
}

