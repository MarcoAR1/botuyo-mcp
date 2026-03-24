import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'

export const DELETE_AGENT_TOOL: Tool = {
  name: 'delete_agent',
  description:
    'Delete an agent (soft delete). This action is IRREVERSIBLE — the agent will be deactivated and hidden.\n\n' +
    '⚠️ IMPORTANT: This tool requires explicit confirmation. You MUST set `confirm` to true AND provide the exact agent name in `confirmName` to proceed.\n\n' +
    'Requires role: owner, admin, or developer.',
  inputSchema: {
    type: 'object',
    properties: {
      agentId: {
        type: 'string',
        description: 'The MongoDB ID of the agent to delete'
      },
      confirm: {
        type: 'boolean',
        description: 'Must be true to confirm deletion. If false or missing, the deletion will be rejected.'
      },
      confirmName: {
        type: 'string',
        description:
          'The exact name of the agent to delete (for safety confirmation). Must match the actual agent name.'
      }
    },
    required: ['agentId', 'confirm', 'confirmName']
  }
}

export async function deleteAgentHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  const { agentId, confirm, confirmName } = args

  if (!confirm) {
    return {
      error: 'Deletion not confirmed. Set confirm=true and provide the agent name in confirmName to proceed.'
    }
  }

  if (!confirmName || typeof confirmName !== 'string' || confirmName.trim().length === 0) {
    return {
      error:
        'Safety check failed: you must provide the exact agent name in confirmName to confirm deletion.'
    }
  }

  // First, get the agent to verify the name matches
  const agent = (await client.get(`/api/v1/mcp/agents/${agentId as string}`)) as any
  const actualName = agent?.data?.name || agent?.name

  if (!actualName) {
    return { error: `Agent ${agentId} not found.` }
  }

  if (actualName.trim() !== (confirmName as string).trim()) {
    return {
      error: `Name mismatch: you provided "${confirmName}" but the agent is named "${actualName}". Please provide the exact name to confirm deletion.`
    }
  }

  // Confirmed — proceed with deletion
  const result = await client.delete(`/api/v1/mcp/agents/${agentId as string}`)

  return {
    success: true,
    message: `Agent "${actualName}" (${agentId}) has been deleted.`,
    ...(result as object)
  }
}
