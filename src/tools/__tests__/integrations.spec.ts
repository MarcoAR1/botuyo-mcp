import { describe, it, expect, afterEach } from 'vitest'
import {
  listIntegrationsHandler,
  configureIntegrationHandler,
  removeIntegrationHandler
} from '../integrations.js'

class MockClient {
  public gets: string[] = []
  public posts: Array<{ path: string; payload: any }> = []
  public deletes: string[] = []
  async get(path: string) {
    this.gets.push(path)
    return { success: true, data: { available: [], installed: [] } }
  }
  async post(path: string, payload: any) {
    this.posts.push({ path, payload })
    return { success: true, data: { integrationId: 'shopify', status: 'active' } }
  }
  async delete(path: string) {
    this.deletes.push(path)
    return { success: true }
  }
}

describe('listIntegrationsHandler', () => {
  it('GETs the MCP integrations namespace', async () => {
    const client = new MockClient()
    await listIntegrationsHandler(client as any)
    expect(client.gets[0]).toBe('/api/v1/mcp/integrations')
  })
})

describe('configureIntegrationHandler', () => {
  it('POSTs integrationId + literal config', async () => {
    const client = new MockClient()
    await configureIntegrationHandler(client as any, {
      integrationId: 'shopify',
      config: { apiUrl: 'https://x', apiKey: 'sk-123' }
    })
    expect(client.posts[0].path).toBe('/api/v1/mcp/integrations/configure')
    expect(client.posts[0].payload).toEqual({
      integrationId: 'shopify',
      config: { apiUrl: 'https://x', apiKey: 'sk-123' }
    })
  })

  it('throws when integrationId is missing', async () => {
    const client = new MockClient()
    await expect(configureIntegrationHandler(client as any, {})).rejects.toThrow(/integrationId/i)
  })

  describe('configFromEnv (keeps secrets out of the chat)', () => {
    afterEach(() => {
      delete process.env.TEST_SHOPIFY_KEY
    })

    it('resolves + merges the secret from the MCP server environment', async () => {
      process.env.TEST_SHOPIFY_KEY = 'sk-from-env'
      const client = new MockClient()
      await configureIntegrationHandler(client as any, {
        integrationId: 'shopify',
        config: { apiUrl: 'https://x' },
        configFromEnv: { apiKey: 'TEST_SHOPIFY_KEY' }
      })
      expect(client.posts[0].payload.config).toEqual({ apiUrl: 'https://x', apiKey: 'sk-from-env' })
    })

    it('throws a helpful error when the env var is not set', async () => {
      const client = new MockClient()
      await expect(
        configureIntegrationHandler(client as any, {
          integrationId: 'shopify',
          configFromEnv: { apiKey: 'DEFINITELY_UNSET_ENV_VAR_XYZ' }
        })
      ).rejects.toThrow(/DEFINITELY_UNSET_ENV_VAR_XYZ/)
      expect(client.posts).toHaveLength(0)
    })
  })
})

describe('removeIntegrationHandler', () => {
  it('DELETEs by integration id', async () => {
    const client = new MockClient()
    await removeIntegrationHandler(client as any, { integrationId: 'shopify' })
    expect(client.deletes[0]).toBe('/api/v1/mcp/integrations/shopify')
  })

  it('throws when integrationId is missing', async () => {
    const client = new MockClient()
    await expect(removeIntegrationHandler(client as any, {})).rejects.toThrow(/integrationId/i)
  })
})
