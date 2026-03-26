import { describe, it, expect } from 'vitest'
import { deleteAgentHandler } from '../delete_agent.js'

class MockClient {
  public calledGet = false
  public calledDelete = false
  async get(path: string) {
    this.calledGet = true
    return { success: true, data: { name: 'DeleteMe' } }
  }
  async delete(path: string) {
    expect(path).toBe('/api/v1/mcp/agents/delete-1')
    this.calledDelete = true
    return { success: true }
  }
}

describe('deleteAgentHandler', () => {
  it('should not delete if confirmation fails', async () => {
    const client = new MockClient() as any
    const res = await deleteAgentHandler(client, { agentId: 'delete-1', confirm: false, confirmName: 'DeleteMe' })
    expect((res as any).error).toBeDefined()
    expect(client.calledDelete).toBe(false)
  })

  it('should delete if confirmation matches name', async () => {
    const client = new MockClient() as any
    const res = await deleteAgentHandler(client, { agentId: 'delete-1', confirm: true, confirmName: 'DeleteMe' })
    expect(client.calledGet).toBe(true)
    expect(client.calledDelete).toBe(true)
    expect((res as any).success).toBe(true)
  })
})
