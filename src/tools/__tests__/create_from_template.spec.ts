import { describe, it, expect } from 'vitest'
import { createFromTemplateHandler } from '../create_from_template.js'

class MockClient {
  public methodCalls: any[] = []
  async post(path: string, payload: any) {
    this.methodCalls.push({ path, payload })
    return { success: true, agentId: 'new-agent-123' }
  }
}

describe('createFromTemplateHandler', () => {
  it('should POST to /api/v1/mcp/agents/from-template with template args', async () => {
    const client = new MockClient() as any
    const args = { templateId: 't1', businessName: 'Biz', services: [] }
    const res = await createFromTemplateHandler(client, args)
    
    expect(client.methodCalls[0].path).toBe('/api/v1/mcp/agents/from-template')
    expect(client.methodCalls[0].payload.templateId).toBe('t1')
    expect(client.methodCalls[0].payload.businessName).toBe('Biz')
    expect((res as any).success).toBe(true)
  })
})
