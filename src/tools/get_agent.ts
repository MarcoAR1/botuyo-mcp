import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'
import { shortId } from '../format.js'

export const GET_AGENT_TOOL: Tool = {
  name: 'get_agent',
  description:
    'Get the full configuration of a specific agent. Returns a name-first `text` summary plus the raw ' +
    'API body. NOTE: the editable config lives UNDER `data.agentConfig` — `agentConfig.identity` ' +
    '(tone, language, objective, customInstructions), `agentConfig.enabledTools`, `agentConfig.stages`, ' +
    'and `agentConfig.widgetConfig`/voice — NOT at the top level.',
  inputSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string', description: 'The MongoDB ID of the agent' }
    },
    required: ['agentId']
  }
}

export async function getAgentHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  const agentId = args.agentId as string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = (await client.get(`/api/v1/mcp/agents/${agentId}`)) as any
  const agent = res?.data ?? {}
  const cfg = agent.agentConfig ?? {}
  const toolCount = Array.isArray(cfg.enabledTools) ? cfg.enabledTools.length : 0
  const stageCount = Array.isArray(cfg.stages) ? cfg.stages.length : 0
  const name = agent.name ?? '(unnamed)'
  const text = agent.id
    ? `${name}  (${shortId(agent.id)})  [${agent.status ?? 'unknown'}]  · ${toolCount} tools · ${stageCount} stages` +
      (cfg.identity?.objective ? `\nObjective: ${cfg.identity.objective}` : '')
    : 'Agent not found.'
  return { ...res, text }
}
