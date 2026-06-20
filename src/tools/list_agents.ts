import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'
import { shortId } from '../format.js'

export const LIST_AGENTS_TOOL: Tool = {
  name: 'list_agents',
  description: 'Lists all agents for the authenticated tenant. Returns a name-first text summary (AgentFamily variants are tagged with their variantKey) plus structured data (full id, shortId, name, description, status, enabled tools count, familyId, variantKey).',
  inputSchema: { type: 'object', properties: {}, required: [] }
}

export async function listAgentsHandler(client: BotuyoApiClient, _args: Record<string, unknown>) {
  const res = (await client.get('/api/v1/mcp/agents')) as any
  const agents = Array.isArray(res?.data) ? res.data : []
  const data = agents.map((a: any) => ({ ...a, shortId: shortId(a.id) }))
  const text = data.length
    ? data
        .map((a: any, i: number) => {
          const family = a.familyId ? `  · family:${a.variantKey ?? shortId(a.familyId)}` : ''
          return `${i + 1}. ${a.name}  (${a.shortId})  [${a.status}]${family}  · ${a.enabledToolsCount ?? 0} tools`
        })
        .join('\n')
    : 'No agents found.'
  return { success: res?.success ?? true, count: data.length, data, text }
}
