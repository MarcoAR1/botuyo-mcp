import { describe, it, expect } from 'vitest'
import { getAgentHandler } from '../get_agent.js'

class MockClient {
  async get(path: string) {
    expect(path).toBe('/api/v1/mcp/agents/ag-123')
    return {
      success: true,
      data: {
        id: 'ag-123',
        name: 'Agent',
        status: 'published',
        agentConfig: { enabledTools: ['a', 'b'], stages: [{ id: 's1' }], identity: { objective: 'Sell' } }
      }
    }
  }
}

describe('getAgentHandler', () => {
  it('should GET agent dynamically by ID and include a name-first text summary', async () => {
    const client = new MockClient() as any
    const res = await getAgentHandler(client, { agentId: 'ag-123' })
    expect((res as any).data.name).toBe('Agent')
    // name-first summary reads counts + objective from UNDER agentConfig
    expect((res as any).text).toContain('Agent')
    expect((res as any).text).toContain('2 tools')
    expect((res as any).text).toContain('Objective: Sell')
  })

  it('throws on missing agentId', async () => {
    await expect(getAgentHandler({} as any, {})).rejects.toThrow()
  })
})
