import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'
import { assertToolInput } from '../toolProtocol.js'

export const GET_TOOL_CONTRACT_TOOL: Tool = {
  name: 'get_tool_contract',
  description: 'Read the resolved invocation schema for an agent tool and channel, including aliases, configured enums and availability. Does not execute the tool or expose saved parameter values. Supports drafts. Use after configure_agent_tool; unavailableReason explains filtering.',
  inputSchema: { type: 'object', additionalProperties: false, required: ['agentId', 'toolName'], properties: {
    agentId: { type: 'string', minLength: 1 }, toolName: { type: 'string', minLength: 1 },
    channel: { type: 'string', enum: ['web', 'whatsapp', 'telegram', 'discord', 'instagram', 'phone', 'kiosk'], default: 'web' }
  } },
  outputSchema: { type: 'object', required: ['success', 'data'], properties: { success: { type: 'boolean' }, data: { type: 'object', required: ['available', 'invocationSchema'], properties: { available: { type: 'boolean' }, invocationSchema: { type: ['object', 'null'] } } } } }
}

export async function getToolContractHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  assertToolInput(GET_TOOL_CONTRACT_TOOL, args)
  return client.get(`/api/v1/mcp/agents/${encodeURIComponent(String(args.agentId))}/tool-contracts/${encodeURIComponent(String(args.toolName))}?channel=${encodeURIComponent(String(args.channel || 'web'))}`)
}
