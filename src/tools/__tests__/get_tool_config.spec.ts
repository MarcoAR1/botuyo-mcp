import { describe, it, expect } from 'vitest'
import { getToolConfigHandler } from '../get_tool_config.js'

class MockGetClient {
  async get(path: string) {
    expect(path).toBe('/api/v1/mcp/agents/a1/tools/t1/config')
    return { success: true, fake: 'data' }
  }
}

describe('getToolConfigHandler', () => {
  it('should perform GET request to fetch tool config', async () => {
    const client = new MockGetClient() as any
    const res = await getToolConfigHandler(client, { agentId: 'a1', toolName: 't1' })
    expect((res as any).success).toBe(true)
    expect((res as any).fake).toBe('data')
  })
})
