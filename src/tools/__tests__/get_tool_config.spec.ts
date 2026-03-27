import { describe, it, expect } from 'vitest'
import { getToolConfigHandler } from '../get_tool_config.js'

class MockGetClient {
  async get(path: string) {
    expect(path).toBe('/api/v1/mcp/agents/a1/tool-configs')
    return {
      success: true,
      data: {
        configured: [
          { toolName: 'send_email', mode: 'single', params: { fromEmail: 'test@test.com' } },
          { toolName: 'webhook_pedidos', mode: 'multi-instance', baseTool: 'call_webhook' }
        ],
        enabledWithoutConfig: ['google_search']
      }
    }
  }
}

describe('getToolConfigHandler', () => {
  it('should return the matching tool config from the list', async () => {
    const client = new MockGetClient() as any
    const res = await getToolConfigHandler(client, { agentId: 'a1', toolName: 'send_email' }) as any
    expect(res.toolName).toBe('send_email')
    expect(res.mode).toBe('single')
    expect(res.params.fromEmail).toBe('test@test.com')
  })

  it('should return text message if tool not found', async () => {
    const client = new MockGetClient() as any
    const res = await getToolConfigHandler(client, { agentId: 'a1', toolName: 'nonexistent' }) as any
    expect(res.text).toContain('no tiene configuración')
  })

  it('should throw if missing arguments', async () => {
    await expect(getToolConfigHandler({} as any, { agentId: 'a1' })).rejects.toThrow('agentId and toolName are required')
  })
})
