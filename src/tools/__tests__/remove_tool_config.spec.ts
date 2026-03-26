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
  it('should perform DELETE request with removeFromEnabled=true', async () => {
    const client = new MockDeleteClient() as any
    await removeToolConfigHandler(client, { agentId: 'a1', toolName: 't1', removeFromEnabled: true })
    expect(client.paths[0]).toBe('/api/v1/mcp/agents/a1/tools/t1/config?removeFromEnabled=true')
  })

  it('should perform DELETE request without query param if removeFromEnabled is omitted', async () => {
    const client = new MockDeleteClient() as any
    await removeToolConfigHandler(client, { agentId: 'a1', toolName: 't1' })
    expect(client.paths[0]).toBe('/api/v1/mcp/agents/a1/tools/t1/config')
  })

  it('should throw if missing arguments', async () => {
    const client = new MockDeleteClient() as any
    await expect(removeToolConfigHandler(client, { agentId: 'a1' })).rejects.toThrow('agentId and toolName are required')
  })
})
