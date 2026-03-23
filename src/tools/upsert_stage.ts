import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'

export const UPSERT_STAGE_TOOL: Tool = {
  name: 'upsert_stage',
  description: `Create or update a named stage in an agent's conversation flow.

A stage defines what the agent does at a particular step in the conversation.
Stages are nodes in a graph connected by edges (connections).

Examples of stage names: "welcomeStage", "salesStage", "hostStage", "checkoutStage"

The stage config is merged with existing stages — existing stages you don't specify are kept unchanged.
Connections and channelFlows replace existing values when provided.

Requires role: owner, admin, or developer.`,
  inputSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string', description: 'The MongoDB ID of the agent' },
      stageName: { type: 'string', description: 'Name key for this stage (e.g. "welcomeStage", "salesStage")' },
      stageConfig: {
        type: 'object',
        description: 'Full stage configuration object.',
        properties: {
          label: { type: 'string', description: 'Human-readable label for this stage' },
          instruction: { type: 'string', description: 'Instructions for the AI in this stage' },
          type: { type: 'string', description: 'Node type: start, action, router, or end (default: action)' },
          tools: { type: 'array', items: { type: 'string' }, description: 'Tool IDs available in this stage' },
          trigger: { type: 'string', description: 'Optional trigger condition (legacy)' },
          channels: { type: 'array', items: { type: 'string' }, description: 'Channels where this stage is active (legacy)' }
        }
      },
      connections: {
        type: 'array',
        description: 'Graph edges between stages. Replaces ALL existing connections.',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Unique connection ID (e.g. "c1", "c2")' },
            from: { type: 'string', description: 'Source stage ID' },
            to: { type: 'string', description: 'Target stage ID' },
            type: { type: 'string', description: '"default" (always follow) or "conditional" (LLM evaluates)' },
            condition: { type: 'string', description: 'Natural language condition (for conditional type)' }
          },
          required: ['id', 'from', 'to', 'type']
        }
      },
      channelFlows: {
        type: 'object',
        description: 'Per-channel flow overrides. Key = channel name, value = { connections: [...] }. Replaces ALL existing channelFlows.',
        additionalProperties: {
          type: 'object',
          properties: {
            connections: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  from: { type: 'string' },
                  to: { type: 'string' },
                  type: { type: 'string' },
                  condition: { type: 'string' }
                },
                required: ['id', 'from', 'to', 'type']
              }
            }
          }
        }
      }
    },
    required: ['agentId', 'stageName', 'stageConfig']
  }
}

export async function upsertStageHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  const { agentId, stageName, stageConfig, connections, channelFlows } = args
  const payload: Record<string, unknown> = {
    stages: { [stageName as string]: stageConfig }
  }

  // Include connections and channelFlows if provided
  if (connections !== undefined) {
    payload.connections = connections
  }
  if (channelFlows !== undefined) {
    payload.channelFlows = channelFlows
  }

  return client.put(`/api/v1/mcp/agents/${agentId as string}`, payload)
}
