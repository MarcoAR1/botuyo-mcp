/**
 * Credential storage for @botuyo/mcp
 * Saves/reads JWT tokens to/from ~/.botuyo/credentials.json
 */

import { readFile, writeFile, mkdir, unlink } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'

const CONFIG_DIR = join(homedir(), '.botuyo')
const CREDENTIALS_FILE = join(CONFIG_DIR, 'credentials.json')

export interface BotuyoCredentials {
  token: string
  tenantId: string
  tenantName: string
  role: string
  email: string
  savedAt: string
  expiresAt: string // ISO date when the JWT expires
  apiUrl?: string   // API URL used during login (persisted so MCP server uses the same backend)
}

export async function readCredentials(): Promise<BotuyoCredentials | null> {
  try {
    const raw = await readFile(CREDENTIALS_FILE, 'utf8')
    return JSON.parse(raw) as BotuyoCredentials
  } catch {
    return null
  }
}

export async function saveCredentials(creds: BotuyoCredentials): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true })
  await writeFile(CREDENTIALS_FILE, JSON.stringify(creds, null, 2), 'utf8')
}

export async function clearCredentials(): Promise<void> {
  try {
    await unlink(CREDENTIALS_FILE)
  } catch {
    // already gone
  }
}

/**
 * Resolve the JWT token to use, in priority order:
 * 1. BOTUYO_TOKEN env var
 * 2. ~/.botuyo/credentials.json
 *
 * Returns null if no token or if expired.
 */
export async function resolveToken(): Promise<string | null> {
  if (process.env.BOTUYO_TOKEN) return process.env.BOTUYO_TOKEN

  const creds = await readCredentials()
  if (!creds?.token) return null

  // Check if expired — auto-clear stale credentials
  if (creds.expiresAt && new Date(creds.expiresAt) < new Date()) {
    await clearCredentials()
    return null // expired
  }

  return creds.token
}

/**
 * Check if stored credentials are expired
 */
export async function isTokenExpired(): Promise<boolean> {
  const creds = await readCredentials()
  if (!creds?.expiresAt) return true
  return new Date(creds.expiresAt) < new Date()
}

/**
 * Resolve the API URL to use, in priority order:
 * 1. BOTUYO_API_URL env var
 * 2. apiUrl from ~/.botuyo/credentials.json
 * 3. Default: https://api.botuyo.com
 */
export const DEFAULT_API_URL = 'https://api.botuyo.com'

export async function resolveApiUrl(): Promise<string> {
  if (process.env.BOTUYO_API_URL) return process.env.BOTUYO_API_URL

  const creds = await readCredentials()
  if (creds?.apiUrl) return creds.apiUrl

  return DEFAULT_API_URL
}

/**
 * Check if there is a valid existing session.
 * Returns the credentials if valid, null if re-auth is needed.
 *
 * Logic:
 * 1. No credentials on disk → null
 * 2. Locally expired → clear + null
 * 3. force=true → null (skip validation)
 * 4. Server rejects token → clear + null
 * 5. Network error → assume valid (return creds)
 * 6. Valid → return creds
 */
export async function checkExistingSession(apiUrl: string, force: boolean): Promise<BotuyoCredentials | null> {
  const creds = await readCredentials()
  if (!creds) return null

  // Locally expired
  if (creds.expiresAt && new Date(creds.expiresAt) < new Date()) {
    await clearCredentials()
    return null
  }

  // Force re-auth
  if (force) return null

  // Verify with server
  try {
    const res = await fetch(`${apiUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${creds.token}` }
    })
    if (!res.ok) {
      await clearCredentials()
      return null
    }
    const body = await res.json() as any
    if (!body.success) {
      await clearCredentials()
      return null
    }
    return creds
  } catch {
    // Network error — don't clear, assume valid
    return creds
  }
}

// ── Shared API helpers (used by login, auth, tenants, switch_tenant) ─────────

export interface UserInfo {
  tenantIds: string[]
  roles: Array<{ tenantId: string; role: string }>
  email: string
}

/**
 * Fetch the current user's info from GET /api/auth/me.
 * Returns parsed UserInfo or throws on failure.
 */
export async function fetchUserInfo(apiUrl: string, token: string): Promise<UserInfo> {
  const res = await fetch(`${apiUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  const data = (await res.json()) as any
  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch user info')
  }
  const user = data.data.user
  return {
    tenantIds: user.tenantIds || [],
    roles: user.roles || [],
    email: user.email
  }
}

/**
 * Resolve a tenant's display name via GET /api/tenants/:id.
 * Returns the name or the tenantId as fallback (never throws).
 */
export async function resolveTenantName(apiUrl: string, token: string, tenantId: string): Promise<string> {
  try {
    const res = await fetch(`${apiUrl}/api/tenants/${tenantId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const data = (await res.json()) as any
    return data.data?.name || data.data?.tenant?.name || tenantId
  } catch {
    return tenantId
  }
}
