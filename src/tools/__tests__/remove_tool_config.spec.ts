import { describe, it, expect } from 'vitest'
import { removeToolConfigHandler } from '../remove_tool_config.js'

class MockDeleteClient {
  public paths: string[] = []
  async delete(path: string) {
    this.paths.push(path)
    return { success: true }
  }
}

describe('removeToolConfigHandler', () => {
  it('should DELETE to /tool-config/:toolName', async () => {
    const client = new MockDeleteClient() as any
    await removeToolConfigHandler(client, { agentId: 'a1', toolName: 'webhook_pedidos' })
    expect(client.paths[0]).toBe('/api/v1/mcp/agents/a1/tool-config/webhook_pedidos')
  })

  it('should throw if missing arguments', async () => {
    const client = new MockDeleteClient() as any
    await expect(removeToolConfigHandler(client, { agentId: 'a1' })).rejects.toThrow('agentId and toolName are required')
  })
})
