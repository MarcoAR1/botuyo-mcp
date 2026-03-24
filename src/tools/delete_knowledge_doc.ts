import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'

export const DELETE_KNOWLEDGE_DOC_TOOL: Tool = {
  name: 'delete_knowledge_document',
  description: 'Deletes a knowledge base document and all its chunks from the current tenant.',
  inputSchema: {
    type: 'object',
    properties: {
      documentId: { type: 'string', description: 'The ID of the document to delete' },
    },
    required: ['documentId']
  }
}

export async function deleteKnowledgeDocHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  const documentId = args.documentId as string
  if (!documentId) throw new Error('documentId is required')
  return client.delete(`/api/knowledge/documents/${documentId}`)
}
