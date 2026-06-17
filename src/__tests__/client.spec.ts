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

    it('detects an HTML proxy/firewall block and throws a clear error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        text: async () => '<!DOCTYPE html><html><body>Access blocked by network proxy</body></html>'
      }))

      await expect(client.get('/api/v1/mcp/agents')).rejects.toThrow(/proxy|firewall/i)
    })
  })

  // ── retry / backoff ─────────────────────────────────────────────────

  describe('retry / backoff', () => {
    function client0() {
      return new BotuyoApiClient({ apiUrl: 'http://localhost:8080', token: 't', retry: { retries: 2, baseDelayMs: 0 } })
    }

    it('retries on a 5xx then succeeds', async () => {
      const fn = vi.fn()
        .mockResolvedValueOnce({ status: 503, ok: false, text: async () => JSON.stringify({ error: 'down' }) })
        .mockResolvedValueOnce({ status: 200, ok: true, text: async () => JSON.stringify({ success: true, data: 1 }) })
      vi.stubGlobal('fetch', fn)

      const res = await client0().get('/api/v1/mcp/agents')
      expect(res.success).toBe(true)
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('gives up after exhausting retries on persistent 5xx', async () => {
      const fn = vi.fn().mockResolvedValue({ status: 503, ok: false, text: async () => JSON.stringify({ error: 'down' }) })
      vi.stubGlobal('fetch', fn)

      await expect(client0().get('/api/v1/mcp/agents')).rejects.toMatchObject({ status: 503 })
      expect(fn).toHaveBeenCalledTimes(3) // 1 + 2 retries
    })

    it('does NOT retry on 4xx', async () => {
      const fn = vi.fn().mockResolvedValue({ status: 400, ok: false, text: async () => JSON.stringify({ error: 'bad' }) })
      vi.stubGlobal('fetch', fn)

      await expect(client0().get('/api/v1/mcp/agents')).rejects.toMatchObject({ status: 400 })
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('retries on a thrown network error then succeeds', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValueOnce({ status: 200, ok: true, text: async () => JSON.stringify({ success: true }) })
      vi.stubGlobal('fetch', fn)

      const res = await client0().get('/api/v1/mcp/agents')
      expect(res.success).toBe(true)
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('throws an ApiError after a persistent network error', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('ENOTFOUND'))
      vi.stubGlobal('fetch', fn)

      await expect(client0().get('/api/v1/mcp/agents')).rejects.toBeInstanceOf(ApiError)
      expect(fn).toHaveBeenCalledTimes(3)
    })
  })
})
