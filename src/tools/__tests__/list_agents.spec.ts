import { describe, it, expect } from 'vitest'
import { listAgentsHandler } from '../list_agents.js'

class MockClient {
  async get(path: string) {
    expect(path).toBe('/api/v1/mcp/agents')
    return { success: true, data: [{ id: '1', name: 'A1' }] }
  }
}

describe('listAgentsHandler', () => {
  it('should call GET /api/v1/mcp/agents', async () => {
    const client = new MockClient() as any
    const res = await listAgentsHandler(client, {})
    expect(Array.isArray((res as any).data)).toBe(true)
  })
})
