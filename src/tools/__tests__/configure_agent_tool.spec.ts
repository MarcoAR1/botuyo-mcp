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
  it('should call the botuyo backend with correct PUT request', async () => {
    const client = new MockPutClient() as any
    const payloadOpts = {
      agentId: 'agent-123',
      toolName: 'send_email',
      baseTool: 'email_factory',
      params: { templateId: '123' },
      instruction: 'Send email safely'
    }

    await configureAgentToolHandler(client, payloadOpts)

    expect(client.methodCalls.length).toBe(1)
    expect(client.methodCalls[0].path).toBe('/api/v1/mcp/agents/agent-123/tools/config')
    expect(client.methodCalls[0].payload).toMatchObject({
      toolName: 'send_email',
      baseTool: 'email_factory',
      params: { templateId: '123' },
      instruction: 'Send email safely'
    })
  })

  it('should throw error if agentId or toolName is missing', async () => {
    const client = new MockPutClient() as any
    await expect(configureAgentToolHandler(client, { agentId: 'a1' })).rejects.toThrow('agentId and toolName are required')
    await expect(configureAgentToolHandler(client, { toolName: 't1' })).rejects.toThrow('agentId and toolName are required')
  })
})
