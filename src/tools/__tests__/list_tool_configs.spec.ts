import { describe, it, expect } from 'vitest'
import { listToolConfigsHandler } from '../list_tool_configs.js'

class MockGetClient {
  async get(path: string) {
    expect(path).toBe('/api/v1/mcp/agents/agent-1/tool-configs')
    return {
      success: true,
      data: {
        configured: [
          { toolName: 'send_email', mode: 'single', params: { fromEmail: 'test@test.com' } },
          { toolName: 'webhook_pedidos', mode: 'multi-instance', baseTool: 'call_webhook', params: { url: 'https://api.com/pedidos' }, instruction: 'Envía pedidos' }
        ],
        enabledWithoutConfig: ['google_search', 'identify_client'],
        multiInstanceSummary: {
          call_webhook: ['webhook_pedidos']
        }
      }
    }
  }
}

describe('listToolConfigsHandler', () => {
  it('should list tools grouped by configured, enabled without config, and multi-instance summary', async () => {
    const client = new MockGetClient() as any
    const res = await listToolConfigsHandler(client, { agentId: 'agent-1' }) as { text: string }
    
    expect(res.text).toContain('Tools configuradas (2)')
    expect(res.text).toContain('• send_email [single]')
    expect(res.text).toContain('• webhook_pedidos [multi-instance: call_webhook]')
    expect(res.text).toContain('params: fromEmail')
    expect(res.text).toContain('instruction: "Envía pedidos"')
    expect(res.text).toContain('Tools habilitadas sin config (2)')
    expect(res.text).toContain('• google_search')
    expect(res.text).toContain('Instancias multi-instance')
    expect(res.text).toContain('call_webhook: webhook_pedidos')
  })

  it('should throw an error if agentId is missing', async () => {
    await expect(listToolConfigsHandler({} as any, {})).rejects.toThrow('agentId is required')
  })
})
