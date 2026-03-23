import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'

export const CREATE_FROM_TEMPLATE_TOOL: Tool = {
  name: 'create_from_template',
  description: `Create a new agent from a pre-built template.

Templates contain pre-configured stages, connections (graph flow), tools, and channel overrides
for specific industries. Business data (name, phone, email, services) is automatically
hydrated into the template placeholders.

Use list_templates first to see available templates.

Requires role: owner, admin, or developer.`,
  inputSchema: {
    type: 'object',
    properties: {
      templateId: {
        type: 'string',
        description: 'Template ID from list_templates (e.g. "beauty-salon", "dental-clinic", "restaurant-bar")'
      },
      businessName: {
        type: 'string',
        description: 'Business name — will replace {{businessName}} in the template'
      },
      contactPhone: {
        type: 'string',
        description: 'Optional contact phone number'
      },
      contactEmail: {
        type: 'string',
        description: 'Optional contact email'
      },
      address: {
        type: 'string',
        description: 'Optional business address'
      },
      services: {
        type: 'array',
        description: 'Optional list of services with name, duration (minutes), and price',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            duration: { type: 'number', description: 'Duration in minutes' },
            price: { type: 'number', description: 'Price (optional)' }
          },
          required: ['name', 'duration']
        }
      }
    },
    required: ['templateId', 'businessName']
  }
}

export async function createFromTemplateHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  return client.post('/api/v1/mcp/agents/from-template', args)
}
