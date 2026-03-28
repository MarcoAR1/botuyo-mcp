import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'

export const RESTORE_AGENT_VERSION_TOOL: Tool = {
  name: 'restore_agent_version',
  description:
    'Restore an agent to a previous version (rollback). The current config is automatically saved as a new snapshot before restoring, so you can always undo a restore. Use list_agent_versions first to see available versions.\n\nRequires role: owner, admin, or developer.',
  inputSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string', description: 'The MongoDB ID of the agent' },
      version: { type: 'number', description: 'Version number to restore (from list_agent_versions)' }
    },
    required: ['agentId', 'version']
  }
}

export async function restoreAgentVersionHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  const agentId = args.agentId as string
  const version = args.version as number
  return client.post(`/api/v1/mcp/agents/${agentId}/versions/${version}/restore`, {})
}
