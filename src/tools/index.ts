/**
 * MCP Tools Registry — exports ALL_TOOLS and TOOL_HANDLERS
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'

// Import all tool definitions
import { LIST_AGENTS_TOOL, listAgentsHandler } from './list_agents.js'
import { GET_AGENT_TOOL, getAgentHandler } from './get_agent.js'
import { GET_AGENT_STATUS_TOOL, getAgentStatusHandler } from './get_agent_status.js'
import { CREATE_AGENT_TOOL, createAgentHandler } from './create_agent.js'
import { UPDATE_AGENT_TOOL, updateAgentHandler } from './update_agent.js'
import { UPSERT_STAGE_TOOL, upsertStageHandler } from './upsert_stage.js'
import { LIST_TOOLS_TOOL, listToolsHandler } from './list_available_tools.js'
import { UPDATE_ENABLED_TOOLS_TOOL, updateEnabledToolsHandler } from './update_enabled_tools.js'
import { PUBLISH_AGENT_TOOL, publishAgentHandler } from './publish_agent.js'

export const ALL_TOOLS: Tool[] = [
  LIST_AGENTS_TOOL,
  GET_AGENT_TOOL,
  GET_AGENT_STATUS_TOOL,
  CREATE_AGENT_TOOL,
  UPDATE_AGENT_TOOL,
  UPSERT_STAGE_TOOL,
  LIST_TOOLS_TOOL,
  UPDATE_ENABLED_TOOLS_TOOL,
  PUBLISH_AGENT_TOOL,
]

export type ToolHandler = (client: BotuyoApiClient, args: Record<string, unknown>) => Promise<unknown>

export const TOOL_HANDLERS: Record<string, ToolHandler> = {
  list_agents: listAgentsHandler,
  get_agent: getAgentHandler,
  get_agent_status: getAgentStatusHandler,
  create_agent: createAgentHandler,
  update_agent: updateAgentHandler,
  upsert_stage: upsertStageHandler,
  list_available_tools: listToolsHandler,
  update_enabled_tools: updateEnabledToolsHandler,
  publish_agent: publishAgentHandler,
}
