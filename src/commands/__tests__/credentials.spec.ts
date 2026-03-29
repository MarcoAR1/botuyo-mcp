/**
 * credentials.ts — Unit tests
 * Tests for apiUrl persistence, resolveApiUrl, and checkExistingSession
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { join } from 'path'
import { homedir } from 'os'

// We'll mock fs/promises to avoid touching the real filesystem
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  unlink: vi.fn()
}))

// Import after mocking
import { readFile, writeFile, mkdir } from 'fs/promises'
import {
  BotuyoCredentials,
  readCredentials,
  saveCredentials,
  resolveToken,
  resolveApiUrl,
  checkExistingSession
} from '../credentials.js'

const CREDS_PATH = join(homedir(), '.botuyo', 'credentials.json')

function makeCreds(overrides: Partial<BotuyoCredentials> = {}): BotuyoCredentials {
  return {
    token: 'test-jwt-token',
    tenantId: 'tenant-123',
    tenantName: 'My Tenant',
    role: 'owner',
    email: 'user@test.com',
    savedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    apiUrl: 'http://localhost:8080',
    ...overrides
  }
}

describe('credentials', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // Clean env vars between tests
    delete process.env.BOTUYO_TOKEN
    delete process.env.BOTUYO_API_URL
  })

  // ── apiUrl persistence ──────────────────────────────────────────────

  describe('apiUrl in credentials', () => {
    it('saveCredentials includes apiUrl in stored JSON', async () => {
      const creds = makeCreds({ apiUrl: 'http://localhost:8080' })
      await saveCredentials(creds)

      expect(writeFile).toHaveBeenCalledWith(
        CREDS_PATH,
        expect.stringContaining('"apiUrl": "http://localhost:8080"'),
        'utf8'
      )
    })

    it('readCredentials returns apiUrl from stored JSON', async () => {
      const creds = makeCreds({ apiUrl: 'https://api.botuyo.com' })
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(creds))

      const result = await readCredentials()
      expect(result?.apiUrl).toBe('https://api.botuyo.com')
    })

    it('readCredentials returns null apiUrl for legacy credentials without apiUrl', async () => {
      // Simulate old credentials.json that doesn't have apiUrl
      const legacy = {
        token: 'old-token',
        tenantId: 't1',
        tenantName: 'T1',
        role: 'owner',
        email: 'a@b.com',
        savedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString()
      }
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(legacy))

      const result = await readCredentials()
      expect(result).not.toBeNull()
      expect(result?.apiUrl).toBeUndefined()
    })
  })

  // ── resolveApiUrl ───────────────────────────────────────────────────

  describe('resolveApiUrl', () => {
    it('returns BOTUYO_API_URL env var when set (highest priority)', async () => {
      process.env.BOTUYO_API_URL = 'https://env-override.com'
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(makeCreds({ apiUrl: 'http://localhost:8080' })))

      const url = await resolveApiUrl()
      expect(url).toBe('https://env-override.com')
    })

    it('returns apiUrl from credentials when env var is not set', async () => {
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(makeCreds({ apiUrl: 'http://localhost:8080' })))

      const url = await resolveApiUrl()
      expect(url).toBe('http://localhost:8080')
    })

    it('returns default https://api.botuyo.com when no env var and no credentials', async () => {
      vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'))

      const url = await resolveApiUrl()
      expect(url).toBe('https://api.botuyo.com')
    })

    it('returns default when credentials exist but apiUrl is missing (legacy)', async () => {
      const legacy = { token: 'x', tenantId: 'y', tenantName: 'z', role: 'a', email: 'b', savedAt: 'c', expiresAt: 'd' }
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(legacy))

      const url = await resolveApiUrl()
      expect(url).toBe('https://api.botuyo.com')
    })
  })

  // ── checkExistingSession ────────────────────────────────────────────

  describe('checkExistingSession', () => {
    it('returns null when no credentials exist', async () => {
      vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'))

      const result = await checkExistingSession('http://localhost:8080', false)
      expect(result).toBeNull()
    })

    it('returns null and clears when credentials are locally expired', async () => {
      const expired = makeCreds({ expiresAt: new Date(Date.now() - 1000).toISOString() })
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(expired))

      const result = await checkExistingSession('http://localhost:8080', false)
      expect(result).toBeNull()
    })

    it('returns credentials when valid and not forced', async () => {
      const valid = makeCreds()
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(valid))

      // Mock global fetch for server verification
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      })
      vi.stubGlobal('fetch', mockFetch)

      const result = await checkExistingSession('http://localhost:8080', false)
      expect(result).not.toBeNull()
      expect(result?.token).toBe('test-jwt-token')

      vi.unstubAllGlobals()
    })

    it('returns null when --force is true even if credentials are valid', async () => {
      const valid = makeCreds()
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(valid))

      const result = await checkExistingSession('http://localhost:8080', true)
      expect(result).toBeNull()
    })

    it('returns null when server rejects the token (401)', async () => {
      const valid = makeCreds()
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(valid))

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ success: false, error: 'Invalid token' })
      })
      vi.stubGlobal('fetch', mockFetch)

      const result = await checkExistingSession('http://localhost:8080', false)
      expect(result).toBeNull()

      vi.unstubAllGlobals()
    })

    it('returns credentials when server is unreachable (network error = assume valid)', async () => {
      const valid = makeCreds()
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(valid))

      const mockFetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
      vi.stubGlobal('fetch', mockFetch)

      const result = await checkExistingSession('http://localhost:8080', false)
      expect(result).not.toBeNull()

      vi.unstubAllGlobals()
    })
  })

  // ── resolveToken (existing, ensure no regression) ──────────────────

  describe('resolveToken', () => {
    it('returns BOTUYO_TOKEN env var when set', async () => {
      process.env.BOTUYO_TOKEN = 'env-token'
      const token = await resolveToken()
      expect(token).toBe('env-token')
    })

    it('returns token from credentials when env var is not set', async () => {
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(makeCreds()))
      const token = await resolveToken()
      expect(token).toBe('test-jwt-token')
    })

    it('returns null when no credentials and no env var', async () => {
      vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'))
      const token = await resolveToken()
      expect(token).toBeNull()
    })

    it('returns null and clears when credentials are expired', async () => {
      const expired = makeCreds({ expiresAt: new Date(Date.now() - 1000).toISOString() })
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(expired))

      const token = await resolveToken()
      expect(token).toBeNull()
    })
  })
})
