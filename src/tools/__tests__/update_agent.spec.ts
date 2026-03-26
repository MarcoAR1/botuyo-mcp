import { describe, it, expect } from 'vitest'
import { updateAgentHandler } from '../update_agent.js'

class MockClient {
  public methodCalls: any[] = []
  async put(path: string, payload: any) {
    this.methodCalls.push({ path, payload })
    return { success: true }
  }
}

describe('updateAgentHandler', () => {
  it('should call PUT /api/v1/mcp/agents/:id', async () => {
    const client = new MockClient() as any
    const args = { agentId: 'a1', name: 'New Name', identity: { tone: 'friendly' } }
    
    await updateAgentHandler(client, args)
    
    expect(client.methodCalls[0].path).toBe('/api/v1/mcp/agents/a1')
    expect(client.methodCalls[0].payload.name).toBe('New Name')
    expect(client.methodCalls[0].payload.identity.tone).toBe('friendly')
  })

  it('should require agentId', async () => {
    await expect(updateAgentHandler({} as any, {})).rejects.toThrow()
  })
})
