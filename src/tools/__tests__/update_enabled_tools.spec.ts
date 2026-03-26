import { describe, it, expect } from 'vitest'
import { updateEnabledToolsHandler } from '../update_enabled_tools.js'

class MockPutClient {
  public methodCalls: any[] = []
  async put(path: string, payload: any) {
    this.methodCalls.push({ path, payload })
    return { success: true }
  }
}

describe('updateEnabledToolsHandler', () => {
  it('should call PUT to replace enabled tools', async () => {
    const client = new MockPutClient() as any
    await updateEnabledToolsHandler(client, { agentId: 'a1', toolIds: ['t1', 't2'] })
    
    expect(client.methodCalls[0].path).toBe('/api/v1/mcp/agents/a1')
    expect(client.methodCalls[0].payload.enabledTools).toEqual(['t1', 't2'])
  })
})
