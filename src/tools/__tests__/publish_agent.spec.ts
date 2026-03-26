import { describe, it, expect } from 'vitest'
import { publishAgentHandler } from '../publish_agent.js'

class MockPutClient {
  public methodCalls: any[] = []
  async put(path: string, payload: any) {
    this.methodCalls.push({ path, payload })
    return { success: true }
  }
}

describe('publishAgentHandler', () => {
  it('should call PUT /api/v1/mcp/agents/:id/publish', async () => {
    const client = new MockPutClient() as any
    await publishAgentHandler(client, { agentId: 'a1', publish: true })
    
    expect(client.methodCalls[0].path).toBe('/api/v1/mcp/agents/a1/publish')
    expect(client.methodCalls[0].payload.publish).toBe(true)
  })
})
