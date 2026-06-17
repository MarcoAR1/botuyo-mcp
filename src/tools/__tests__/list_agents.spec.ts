import { describe, it, expect } from 'vitest'
import { listAgentsHandler } from '../list_agents.js'

class MockClient {
  async get(path: string) {
    expect(path).toBe('/api/v1/mcp/agents')
    return {
      success: true,
      data: [
        { id: '6988e1877a3c2a943468b9e2', name: 'Nivelador', status: 'published', enabledToolsCount: 3 }
      ]
    }
  }
}

describe('listAgentsHandler', () => {
  it('should call GET /api/v1/mcp/agents and keep a data array', async () => {
    const client = new MockClient() as any
    const res = (await listAgentsHandler(client, {})) as any
    expect(Array.isArray(res.data)).toBe(true)
    expect(res.count).toBe(1)
  })

  it('adds a shortId to each agent without losing the full id', async () => {
    const client = new MockClient() as any
    const res = (await listAgentsHandler(client, {})) as any
    expect(res.data[0].id).toBe('6988e1877a3c2a943468b9e2')
    expect(res.data[0].shortId).toBe('6988e187…b9e2')
  })

  it('returns a name-first text summary', async () => {
    const client = new MockClient() as any
    const res = (await listAgentsHandler(client, {})) as any
    expect(res.text).toContain('Nivelador')
    expect(res.text).toContain('6988e187…b9e2')
    expect(res.text).toContain('published')
  })
})
