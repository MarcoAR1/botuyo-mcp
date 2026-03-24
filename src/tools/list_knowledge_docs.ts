import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'

export const LIST_KNOWLEDGE_DOCS_TOOL: Tool = {
  name: 'list_knowledge_documents',
  description: 'Lists all knowledge base documents for the current tenant. Returns document id, name, type, status, chunks count, and file size.',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of documents to return (default: 50)' },
      offset: { type: 'number', description: 'Number of documents to skip for pagination (default: 0)' },
    },
    required: []
  }
}

export async function listKnowledgeDocsHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  const params = new URLSearchParams()
  if (args.limit) params.append('limit', String(args.limit))
  if (args.offset) params.append('offset', String(args.offset))
  const query = params.toString() ? `?${params.toString()}` : ''
  return client.get(`/api/knowledge/documents${query}`)
}
