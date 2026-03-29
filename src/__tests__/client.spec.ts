/**
 * BotuyoApiClient — Unit tests
 * Tests for error handling, 401 detection, ApiError class
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BotuyoApiClient, ApiError } from '../client.js'

// Mock global fetch
function mockFetch(status: number, body: any, ok?: boolean) {
  const fn = vi.fn().mockResolvedValue({
    status,
    ok: ok ?? (status >= 200 && status < 300),
    text: async () => JSON.stringify(body),
    json: async () => body
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('BotuyoApiClient', () => {
  let client: BotuyoApiClient

  beforeEach(() => {
    vi.restoreAllMocks()
    client = new BotuyoApiClient({ apiUrl: 'http://localhost:8080', token: 'test-token' })
  })

  // ── ApiError class ──────────────────────────────────────────────────

  describe('ApiError', () => {
    it('is an instance of Error', () => {
      const err = new ApiError('test', 401)
      expect(err).toBeInstanceOf(Error)
      expect(err).toBeInstanceOf(ApiError)
    })

    it('stores the HTTP status code', () => {
      const err = new ApiError('Unauthorized', 401)
      expect(err.status).toBe(401)
      expect(err.message).toBe('Unauthorized')
    })

    it('has a name of ApiError', () => {
      const err = new ApiError('test', 500)
      expect(err.name).toBe('ApiError')
    })
  })

  // ── handleResponse / 401 detection ──────────────────────────────────

  describe('401 detection', () => {
    it('throws ApiError with status 401 on unauthorized response', async () => {
      mockFetch(401, { success: false, error: 'Invalid or expired token' })

      try {
        await client.get('/api/v1/mcp/agents')
        expect.fail('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError)
        expect((err as ApiError).status).toBe(401)
      }
    })

    it('throws ApiError with status 403 on forbidden response', async () => {
      mockFetch(403, { success: false, error: 'Forbidden' })

      try {
        await client.get('/api/v1/mcp/agents')
        expect.fail('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError)
        expect((err as ApiError).status).toBe(403)
      }
    })

    it('throws ApiError with status 500 on server error', async () => {
      mockFetch(500, { success: false, error: 'Internal error' })

      try {
        await client.get('/api/v1/mcp/agents')
        expect.fail('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError)
        expect((err as ApiError).status).toBe(500)
      }
    })

    it('does NOT throw on successful 200 responses', async () => {
      mockFetch(200, { success: true, data: { agents: [] } })

      const result = await client.get('/api/v1/mcp/agents')
      expect(result.success).toBe(true)
    })
  })

  // ── verify() ────────────────────────────────────────────────────────

  describe('verify', () => {
    it('returns AuthInfo on successful /api/auth/me', async () => {
      mockFetch(200, {
        success: true,
        data: {
          user: {
            email: 'test@example.com',
            tenantIds: ['t1'],
            roles: [{ tenantId: 't1', role: 'owner' }]
          }
        }
      })

      const info = await client.verify()
      expect(info.email).toBe('test@example.com')
      expect(info.tenantId).toBe('t1')
      expect(info.role).toBe('owner')
    })

    it('throws on 401 from /api/auth/me', async () => {
      mockFetch(401, { success: false, error: 'Token expired' })

      await expect(client.verify()).rejects.toThrow()
    })

    it('caches authInfo after first successful call', async () => {
      const fetchFn = mockFetch(200, {
        success: true,
        data: {
          user: {
            email: 'test@example.com',
            tenantIds: ['t1'],
            roles: [{ tenantId: 't1', role: 'owner' }]
          }
        }
      })

      await client.verify()
      await client.verify()
      expect(fetchFn).toHaveBeenCalledTimes(1)
    })
  })

  // ── Non-JSON responses ──────────────────────────────────────────────

  describe('non-JSON responses', () => {
    it('throws ApiError with status code when response is not JSON', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        status: 502,
        ok: false,
        text: async () => '<html>Bad Gateway</html>'
      }))

      try {
        await client.get('/api/v1/mcp/agents')
        expect.fail('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError)
        expect((err as ApiError).status).toBe(502)
      }
    })
  })
})
