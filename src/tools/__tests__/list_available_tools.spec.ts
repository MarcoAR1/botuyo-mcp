import { describe, it, expect } from 'vitest'
import { listToolsHandler } from '../list_available_tools.js'

class MockClient {
  async get(path: string) {
    expect(path).toBe('/api/v1/mcp/tools')
    return { success: true, data: ['tool1', 'tool2'] }
  }
}

describe('listToolsHandler', () => {
  it('should call GET /api/v1/mcp/tools', async () => {
    const client = new MockClient() as any
    const res = await listToolsHandler(client, {})
    expect((res as any).data.length).toBe(2)
  })
})
