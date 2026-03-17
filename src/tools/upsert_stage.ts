import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'

export const UPSERT_STAGE_TOOL: Tool = {
  name: 'upsert_stage',
  description: `Create or update a named stage in an agent's conversation flow.

A stage defines what the agent does at a particular step in the conversation.
Each stage has a list of "actions" that the agent can take (send_message, use_tool, go_to_stage, etc.).

Examples of stage names: "welcomeStage", "salesStage", "hostStage", "checkoutStage"

The stage config is merged with existing stages — existing stages you don't specify are kept unchanged.

Requires role: owner, admin, or developer.`,
  inputSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string', description: 'The MongoDB ID of the agent' },
      stageName: { type: 'string', description: 'Name key for this stage (e.g. "welcomeStage", "salesStage")' },
      stageConfig: {
        type: 'object',
        description: 'Full stage configuration object. See BotUyo stage schema for full details.',
        properties: {
          label: { type: 'string', description: 'Human-readable label for this stage' },
          instruction: { type: 'string', description: 'Instructions for the AI in this stage' },
          tools: { type: 'array', items: { type: 'string' }, description: 'Tool IDs available in this stage' },
          trigger: { type: 'string', description: 'Optional trigger condition' },
          channels: { type: 'array', items: { type: 'string' }, description: 'Channels where this stage is active' }
        }
      }
    },
    required: ['agentId', 'stageName', 'stageConfig']
  }
}

export async function upsertStageHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  const { agentId, stageName, stageConfig } = args
  return client.put(`/api/v1/mcp/agents/${agentId as string}`, {
    stages: { [stageName as string]: stageConfig }
  })
}
