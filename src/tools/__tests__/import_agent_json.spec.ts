import { describe, it, expect } from 'vitest'
import { importAgentJsonHandler } from '../import_agent_json.js'

class MockPutClient {
  public methodCalls: any[] = []
  async put(path: string, payload: any) {
    this.methodCalls.push({ path, payload })
    return { success: true }
  }
}

describe('importAgentJsonHandler', () => {
  it('should process inline config successfully', async () => {
    const client = new MockPutClient() as any
    const args = {
      agentId: 'a1',
      agentConfig: { name: 'Inline Agent', identity: { language: 'es' } }
    }

    const res = await importAgentJsonHandler(client, args)
    
    expect(client.methodCalls[0].path).toBe('/api/v1/mcp/agents/a1/import')
    expect(client.methodCalls[0].payload.agentConfig.name).toBe('Inline Agent')
    expect((res as any).success).toBe(true)
  })

  it('should return error if missing agentId', async () => {
    const res = await importAgentJsonHandler({} as any, { agentConfig: {} })
    expect((res as any).success).toBe(false)
    expect((res as any).error).toContain('agentId is required')
  })
})
