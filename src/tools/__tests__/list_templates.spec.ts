import { describe, it, expect } from 'vitest'
import { listTemplatesHandler } from '../list_templates.js'

class MockClient {
  async get(path: string) {
    expect(path).toBe('/api/v1/mcp/templates')
    return { success: true, data: [{ id: 'beauty-salon' }] }
  }
}

describe('listTemplatesHandler', () => {
  it('should call GET /api/v1/mcp/templates', async () => {
    const client = new MockClient() as any
    const res = await listTemplatesHandler(client, {})
    expect((res as any).data[0].id).toBe('beauty-salon')
  })
})
