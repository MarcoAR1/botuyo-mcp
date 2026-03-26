import { describe, it, expect } from 'vitest'
import { getAgentStatusHandler } from '../get_agent_status.js'

class MockClient {
  async get(path: string) {
    expect(path).toBe('/api/v1/mcp/agents/a1/status')
    return { success: true, data: { status: 'online' } }
  }
}

describe('getAgentStatusHandler', () => {
  it('should call GET /api/v1/mcp/agents/:id/status', async () => {
    const client = new MockClient() as any
    const res = await getAgentStatusHandler(client, { agentId: 'a1' })
    expect((res as any).data.status).toBe('online')
  })
})
