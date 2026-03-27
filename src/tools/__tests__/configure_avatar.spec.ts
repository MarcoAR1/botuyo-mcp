import { describe, it, expect } from 'vitest'
import { listAvatarsHandler, selectAvatarHandler } from '../configure_avatar.js'

class MockClient {
  private routes: Record<string, any> = {}

  mockGet(path: string, response: any) {
    this.routes[`GET:${path}`] = response
    return this
  }

  mockPost(path: string, response: any) {
    this.routes[`POST:${path}`] = response
    return this
  }

  async get(path: string) {
    return this.routes[`GET:${path}`] || { success: false }
  }

  async post(path: string, _body?: any) {
    return this.routes[`POST:${path}`] || { success: false }
  }
}

describe('listAvatarsHandler', () => {
  it('should return formatted catalog text', async () => {
    const client = new MockClient()
      .mockGet('/api/avatars/catalog', {
        success: true,
        data: [
          { _id: 'av1', name: 'Corporate F', modelFormat: 'vrm', category: 'corporate', isPremium: false, modelUrl: 'https://r2/av1.vrm' },
          { _id: 'av2', name: 'Premium Bot', modelFormat: 'glb', category: 'fantasy', isPremium: true, modelUrl: 'https://r2/av2.glb' }
        ]
      })

    const result = await listAvatarsHandler(client as any, {})
    const text = (result as any).text

    expect(text).toContain('av1')
    expect(text).toContain('Corporate F')
    expect(text).toContain('[PREMIUM]')
    expect(text).toContain('VRM')
  })

  it('should handle empty catalog', async () => {
    const client = new MockClient()
      .mockGet('/api/avatars/catalog', { success: true, data: [] })

    const result = await listAvatarsHandler(client as any, {})
    expect((result as any).text).toContain('No hay avatares')
  })

  it('should throw on API failure', async () => {
    const client = new MockClient()
      .mockGet('/api/avatars/catalog', { success: false })

    await expect(listAvatarsHandler(client as any, {})).rejects.toThrow('Could not fetch')
  })
})

describe('selectAvatarHandler', () => {
  it('should select from catalog by avatarId', async () => {
    const client = new MockClient()
      .mockGet('/api/avatars/catalog/av1', { success: true, data: { modelUrl: 'https://r2/av1.vrm' } })
      .mockPost('/api/avatars/select', { success: true, message: 'Avatar updated' })

    const result = await selectAvatarHandler(client as any, { agentId: 'agent_1', avatarId: 'av1' })
    const text = (result as any).text

    expect(text).toContain('✅')
    expect(text).toContain('catálogo')
    expect(text).toContain('https://r2/av1.vrm')
  })

  it('should select by custom URL', async () => {
    const client = new MockClient()
      .mockPost('/api/avatars/select', { success: true, message: 'Avatar updated' })

    const result = await selectAvatarHandler(client as any, { agentId: 'agent_1', avatarUrl: 'https://my.site/avatar.glb' })
    const text = (result as any).text

    expect(text).toContain('✅')
    expect(text).toContain('URL custom')
  })

  it('should throw when agentId missing', async () => {
    const client = new MockClient()
    await expect(selectAvatarHandler(client as any, {})).rejects.toThrow('agentId is required')
  })

  it('should throw when neither avatarId nor avatarUrl provided', async () => {
    const client = new MockClient()
    await expect(selectAvatarHandler(client as any, { agentId: 'a1' })).rejects.toThrow('Provide either')
  })

  it('should throw when both avatarId and avatarUrl provided', async () => {
    const client = new MockClient()
    await expect(selectAvatarHandler(client as any, { agentId: 'a1', avatarId: 'x', avatarUrl: 'y' })).rejects.toThrow('not both')
  })

  it('should throw when catalog avatar not found', async () => {
    const client = new MockClient()
      .mockGet('/api/avatars/catalog/missing', { success: false })

    await expect(selectAvatarHandler(client as any, { agentId: 'a1', avatarId: 'missing' }))
      .rejects.toThrow('not found in catalog')
  })
})
