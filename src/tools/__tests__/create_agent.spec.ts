import { describe, it, expect } from 'vitest'
import { createAgentHandler } from '../create_agent.js'

class MockClient {
  public paths: string[] = []
  public payloads: any[] = []
  async post(path: string, payload: any) {
    this.paths.push(path)
    this.payloads.push(payload)
    return { success: true, data: { id: 'new-agent-123', ...payload } }
  }
}

describe('createAgentHandler', () => {
  it('should call POST /api/v1/mcp/agents with name and description', async () => {
    const client = new MockClient() as any
    const res = await createAgentHandler(client, { name: 'Support Bot', description: 'Helps users', type: 'agent' })
    
    expect(client.paths[0]).toBe('/api/v1/mcp/agents')
    expect(client.payloads[0].name).toBe('Support Bot')
    expect(client.payloads[0].description).toBe('Helps users')
    expect(client.payloads[0].type).toBe('agent')
    expect((res as any).success).toBe(true)
  })
})
