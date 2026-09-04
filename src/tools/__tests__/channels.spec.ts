import { describe, it, expect, afterEach } from 'vitest'
import {
  listChannelsHandler,
  connectChannelHandler,
  disconnectChannelHandler
} from '../channels.js'

class MockClient {
  public gets: string[] = []
  public posts: Array<{ path: string; payload: any }> = []
  public deletes: string[] = []
  async get(path: string) {
    this.gets.push(path)
    return { success: true, data: { channels: [], total: 0 } }
  }
  async post(path: string, payload: any) {
    this.posts.push({ path, payload })
    return { success: true, data: { channelId: 'ch1', status: 'connected' } }
  }
  async delete(path: string) {
    this.deletes.push(path)
    return { success: true, data: { message: 'disconnected' } }
  }
}

describe('listChannelsHandler', () => {
  it('GETs the MCP channels namespace', async () => {
    const client = new MockClient()
    await listChannelsHandler(client as any)
    expect(client.gets[0]).toBe('/api/v1/mcp/channels')
  })
})

describe('connectChannelHandler', () => {
  it('POSTs channelType + config + literal credentials', async () => {
    const client = new MockClient()
    await connectChannelHandler(client as any, {
      channelType: 'telegram',
      config: { botUsername: 'mybot' },
      credentials: { botToken: 'T-123' }
    })
    expect(client.posts[0].path).toBe('/api/v1/mcp/channels/connect')
    expect(client.posts[0].payload).toEqual({
      channelType: 'telegram',
      config: { botUsername: 'mybot' },
      credentials: { botToken: 'T-123' }
    })
  })

  it('throws when channelType is missing', async () => {
    const client = new MockClient()
    await expect(connectChannelHandler(client as any, {})).rejects.toThrow(/channelType/i)
  })

  describe('credentialsFromEnv (keeps secrets out of the chat)', () => {
    afterEach(() => {
      delete process.env.TEST_TG_TOKEN
    })

    it('resolves the secret from the MCP server environment', async () => {
      process.env.TEST_TG_TOKEN = 'secret-from-env'
      const client = new MockClient()
      await connectChannelHandler(client as any, {
        channelType: 'telegram',
        credentialsFromEnv: { botToken: 'TEST_TG_TOKEN' }
      })
      expect(client.posts[0].payload.credentials).toEqual({ botToken: 'secret-from-env' })
    })

    it('merges literal + env credentials', async () => {
      process.env.TEST_TG_TOKEN = 'env-token'
      const client = new MockClient()
      await connectChannelHandler(client as any, {
        channelType: 'whatsapp',
        credentials: { appSecret: 'literal-secret' },
        credentialsFromEnv: { accessToken: 'TEST_TG_TOKEN' }
      })
      expect(client.posts[0].payload.credentials).toEqual({
        appSecret: 'literal-secret',
        accessToken: 'env-token'
      })
    })

    it('throws a helpful error when the env var is not set', async () => {
      const client = new MockClient()
      await expect(
        connectChannelHandler(client as any, {
          channelType: 'telegram',
          credentialsFromEnv: { botToken: 'DEFINITELY_UNSET_ENV_VAR_XYZ' }
        })
      ).rejects.toThrow(/DEFINITELY_UNSET_ENV_VAR_XYZ/)
      expect(client.posts).toHaveLength(0)
    })
  })
})

describe('disconnectChannelHandler', () => {
  it('DELETEs the channel by id', async () => {
    const client = new MockClient()
    await disconnectChannelHandler(client as any, { channelId: 'ch1' })
    expect(client.deletes[0]).toBe('/api/v1/mcp/channels/ch1')
  })

  it('throws when channelId is missing', async () => {
    const client = new MockClient()
    await expect(disconnectChannelHandler(client as any, {})).rejects.toThrow(/channelId/i)
  })
})
