import { describe, it, expect } from 'vitest'
import { configureAgentToolHandler } from '../configure_agent_tool.js'

class MockPutClient {
  public methodCalls: any[] = []
  async put(path: string, payload: any) {
    this.methodCalls.push({ method: 'PUT', path, payload })
    return { success: true, data: payload }
  }
}

describe('configureAgentToolHandler', () => {
  it('should PUT to /tool-config/:toolName with payload (no toolName in body)', async () => {
    const client = new MockPutClient() as any
    await configureAgentToolHandler(client, {
      agentId: 'agent-123',
      toolName: 'send_email',
      baseTool: 'call_webhook',
      params: { templateId: '123' },
      instruction: 'Send email safely'
    })

    expect(client.methodCalls.length).toBe(1)
    expect(client.methodCalls[0].path).toBe('/api/v1/mcp/agents/agent-123/tool-config/send_email')
    expect(client.methodCalls[0].payload).toMatchObject({
      baseTool: 'call_webhook',
      params: { templateId: '123' },
      instruction: 'Send email safely'
    })
    // toolName should NOT be in payload (it's in the URL)
    expect(client.methodCalls[0].payload.toolName).toBeUndefined()
  })

  it('should only include defined fields in payload', async () => {
    const client = new MockPutClient() as any
    await configureAgentToolHandler(client, {
      agentId: 'agent-123',
      toolName: 'send_email',
      params: { fromEmail: 'test@test.com' }
    })

    expect(client.methodCalls[0].payload).toEqual({ params: { fromEmail: 'test@test.com' } })
  })

  it('should throw error if agentId or toolName is missing', async () => {
    const client = new MockPutClient() as any
    await expect(configureAgentToolHandler(client, { agentId: 'a1' })).rejects.toThrow('agentId and toolName are required')
    await expect(configureAgentToolHandler(client, { toolName: 't1' })).rejects.toThrow('agentId and toolName are required')
  })
})
