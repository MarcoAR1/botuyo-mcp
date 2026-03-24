import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'

export const ASSOCIATE_KNOWLEDGE_TOOL: Tool = {
  name: 'associate_knowledge_to_agent',
  description: 'Associates (links) knowledge base document IDs to an agent. Replaces the current list of knowledgeDocumentIds on the agent. Use list_knowledge_documents to get valid document IDs.',
  inputSchema: {
    type: 'object',
    properties: {
      agentId: {
        type: 'string',
        description: 'The MongoDB ID of the agent to update'
      },
      documentIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of knowledge document IDs to associate with the agent. Pass an empty array to remove all.'
      }
    },
    required: ['agentId', 'documentIds']
  }
}

export async function associateKnowledgeHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  const agentId = args.agentId as string
  const documentIds = args.documentIds as string[]

  if (!agentId) throw new Error('agentId is required')
  if (!Array.isArray(documentIds)) throw new Error('documentIds must be an array')

  // Use the MCP agent update endpoint to set knowledgeDocumentIds
  return client.put(`/api/v1/mcp/agents/${agentId}`, {
    knowledgeDocumentIds: documentIds
  })
}

