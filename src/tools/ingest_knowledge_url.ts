import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'

export const INGEST_KNOWLEDGE_URL_TOOL: Tool = {
  name: 'ingest_knowledge_url',
  description: 'Add a URL to the knowledge base. BotUyo will scrape the page content and index it for intelligent search. The document can then be associated to agents using associate_knowledge_to_agent.',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'The URL to scrape and index (must be publicly accessible)' },
      name: { type: 'string', description: 'Optional display name for the document. If omitted, the page title is used.' },
      description: { type: 'string', description: 'Optional description of what this URL contains' },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional tags for categorization (e.g. ["docs", "faq"])'
      },
      topic: { type: 'string', description: 'Optional topic label for search filtering' },
    },
    required: ['url']
  }
}

export async function ingestKnowledgeUrlHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  const url = args.url as string
  if (!url) throw new Error('url is required')

  const body: Record<string, unknown> = { url }
  if (args.name) body.name = args.name
  if (args.description) body.description = args.description
  if (args.tags) body.tags = args.tags
  if (args.topic) body.topic = args.topic

  return client.post('/api/knowledge/urls', body)
}
