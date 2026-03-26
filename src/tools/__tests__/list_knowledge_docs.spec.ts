import { describe, it, expect } from 'vitest'
import { listKnowledgeDocsHandler } from '../list_knowledge_docs.js'

class MockGetClient {
  public path: string | null = null
  async get(path: string) {
    this.path = path
    return { success: true, data: [] }
  }
}

describe('listKnowledgeDocsHandler', () => {
  it('should GET knowledge documents with pagination params', async () => {
    const client = new MockGetClient() as any
    await listKnowledgeDocsHandler(client, { limit: 10, offset: 5 })
    expect(client.path).toBe('/api/knowledge/documents?limit=10&offset=5')
  })

  it('should GET without params if not provided', async () => {
    const client = new MockGetClient() as any
    await listKnowledgeDocsHandler(client, {})
    expect(client.path).toBe('/api/knowledge/documents')
  })
})
