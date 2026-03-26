import { describe, it, expect } from 'vitest'
import { deleteKnowledgeDocHandler } from '../delete_knowledge_doc.js'

class MockDeleteClient {
  public path: string | null = null
  async delete(path: string) {
    this.path = path
    return { success: true }
  }
}

describe('deleteKnowledgeDocHandler', () => {
  it('should DELETE document by ID', async () => {
    const client = new MockDeleteClient() as any
    await deleteKnowledgeDocHandler(client, { documentId: 'doc123' })
    expect(client.path).toBe('/api/knowledge/documents/doc123')
  })
})
