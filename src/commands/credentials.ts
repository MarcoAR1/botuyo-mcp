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

  // Check if expired
  if (creds.expiresAt && new Date(creds.expiresAt) < new Date()) {
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
