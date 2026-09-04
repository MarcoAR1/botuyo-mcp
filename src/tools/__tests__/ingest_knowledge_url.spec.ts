import { describe, it, expect } from 'vitest'
import { ingestKnowledgeUrlHandler } from '../ingest_knowledge_url.js'

class MockPostClient {
  public calls: Array<{ path: string; payload: any }> = []
  async post(path: string, payload: any) {
    this.calls.push({ path, payload })
    return { success: true, data: { id: 'doc1' } }
  }
}

describe('ingestKnowledgeUrlHandler', () => {
  it('POSTs the url to the MCP knowledge namespace', async () => {
    const client = new MockPostClient() as any
    await ingestKnowledgeUrlHandler(client, { url: 'https://example.com' })
    expect(client.calls[0].path).toBe('/api/v1/mcp/knowledge/urls')
    expect(client.calls[0].payload).toEqual({ url: 'https://example.com' })
  })

  it('includes optional fields only when provided', async () => {
    const client = new MockPostClient() as any
    await ingestKnowledgeUrlHandler(client, {
      url: 'https://example.com',
      name: 'Docs',
      description: 'desc',
      tags: ['a', 'b'],
      topic: 'faq'
    })
    expect(client.calls[0].payload).toEqual({
      url: 'https://example.com',
      name: 'Docs',
      description: 'desc',
      tags: ['a', 'b'],
      topic: 'faq'
    })
  })

  it('throws when url is missing', async () => {
    const client = new MockPostClient() as any
    await expect(ingestKnowledgeUrlHandler(client, {})).rejects.toThrow()
  })
})
