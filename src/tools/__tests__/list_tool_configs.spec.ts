import { describe, it, expect } from 'vitest'
import { listToolConfigsHandler } from '../list_tool_configs.js'

class MockGetClient {
  async get(path: string) {
    expect(path).toBe('/api/v1/mcp/agents/agent-1')
    return {
      success: true,
      data: {
        name: 'Agent Tester',
        enabledTools: ['native1', 'configured1'],
        toolConfigs: { configured1: { baseTool: 'sync_document' } }
      }
    }
  }
}

describe('listToolConfigsHandler', () => {
  it('should list tools separating native and configured ones', async () => {
    const client = new MockGetClient() as any
    const res = await listToolConfigsHandler(client, { agentId: 'agent-1' }) as { text: string }
    
    expect(res.text).toContain('Tools del agente "Agent Tester"')
    expect(res.text).toContain('Tools nativas (sin config)')
    expect(res.text).toContain('• native1')
    expect(res.text).toContain('Tools configuradas')
    expect(res.text).toContain('• configured1')
    expect(res.text).toContain('[factory: sync_document]')
  })

  it('should throw an error if agentId is missing', async () => {
    await expect(listToolConfigsHandler({} as any, {})).rejects.toThrow('agentId is required')
  })
})
