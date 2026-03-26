import { describe, it, expect } from 'vitest'
import { associateKnowledgeHandler } from '../associate_knowledge.js'

class MockPutClient {
  public methodCalls: any[] = []
  async put(path: string, payload: any) {
    this.methodCalls.push({ path, payload })
    return { success: true }
  }
}

describe('associateKnowledgeHandler', () => {
  it('should call PUT to update knowledge documents', async () => {
    const client = new MockPutClient() as any
    await associateKnowledgeHandler(client, { agentId: 'a1', documentIds: ['doc1', 'doc2'] })
    
    expect(client.methodCalls[0].path).toBe('/api/v1/mcp/agents/a1')
    expect(client.methodCalls[0].payload.knowledgeDocumentIds).toEqual(['doc1', 'doc2'])
  })

  it('should throw if missing arguments', async () => {
    const client = new MockPutClient() as any
    await expect(associateKnowledgeHandler(client, { agentId: 'a1' })).rejects.toThrow()
    await expect(associateKnowledgeHandler(client, { documentIds: [] })).rejects.toThrow()
  })
})
