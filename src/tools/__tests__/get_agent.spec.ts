import { describe, it, expect } from 'vitest'
import { getAgentHandler } from '../get_agent.js'

class MockClient {
  async get(path: string) {
    expect(path).toBe('/api/v1/mcp/agents/ag-123')
    return { success: true, data: { id: 'ag-123', name: 'Agent' } }
  }
}

describe('getAgentHandler', () => {
  it('should GET agent dynamically by ID', async () => {
    const client = new MockClient() as any
    const res = await getAgentHandler(client, { agentId: 'ag-123' })
    expect((res as any).data.name).toBe('Agent')
  })

  it('throws on missing agentId', async () => {
    await expect(getAgentHandler({} as any, {})).rejects.toThrow()
  })
})
