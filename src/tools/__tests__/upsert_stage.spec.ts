import { describe, it, expect } from 'vitest'
import { upsertStageHandler } from '../upsert_stage.js'

class MockPutClient {
  public methodCalls: any[] = []
  async put(path: string, payload: any) {
    this.methodCalls.push({ path, payload })
    return { success: true }
  }
}

describe('upsertStageHandler', () => {
  it('should PUT merged stage, connections and channelFlows', async () => {
    const client = new MockPutClient() as any
    const args = {
      agentId: 'a1',
      stageName: 'start',
      stageConfig: { instruction: 'Hello' },
      connections: [{ id: 'c1', from: 'start', to: 'end', type: 'default' }],
      channelFlows: { web: { connections: [] } }
    }

    await upsertStageHandler(client, args)

    expect(client.methodCalls[0].path).toBe('/api/v1/mcp/agents/a1')
    expect(client.methodCalls[0].payload.stages.start.instruction).toBe('Hello')
    expect(client.methodCalls[0].payload.connections[0].id).toBe('c1')
    expect(client.methodCalls[0].payload.channelFlows.web).toBeDefined()
  })
})
