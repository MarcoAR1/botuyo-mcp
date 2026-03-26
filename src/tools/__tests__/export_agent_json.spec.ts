import { vi, describe, it, expect } from 'vitest'
import { exportAgentJsonHandler } from '../export_agent_json.js'
import * as fs from 'fs'

vi.mock('fs', () => ({
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn()
}))

class MockGetClient {
  async get(path: string) {
    expect(path).toBe('/api/v1/mcp/agents/a1/export')
    return { 
      success: true, 
      data: { 
        agentId: 'a1', 
        apiKey: 'key', 
        agentConfig: { name: 'Test Bot' } 
      } 
    }
  }
}

describe('exportAgentJsonHandler', () => {
  it('should fetch export data and mock write file correctly', async () => {
    const client = new MockGetClient() as any
    const res = await exportAgentJsonHandler(client, { agentId: 'a1', savePath: './tmp_test' })
    
    expect((res as any).success).toBe(true)
    expect(fs.mkdirSync).toHaveBeenCalled()
    expect(fs.writeFileSync).toHaveBeenCalled()
  })
})
