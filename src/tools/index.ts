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
import { SWITCH_TENANT_TOOL, switchTenantHandler } from './switch_tenant.js'
import { EXPORT_AGENT_JSON_TOOL, exportAgentJsonHandler } from './export_agent_json.js'
import { IMPORT_AGENT_JSON_TOOL, importAgentJsonHandler } from './import_agent_json.js'
import { LIST_TEMPLATES_TOOL, listTemplatesHandler } from './list_templates.js'
import { CREATE_FROM_TEMPLATE_TOOL, createFromTemplateHandler } from './create_from_template.js'
import { EXAMPLE_AGENT_TOOL, exampleAgentHandler } from './example_agent.js'
import { DELETE_AGENT_TOOL, deleteAgentHandler } from './delete_agent.js'
import { LIST_KNOWLEDGE_DOCS_TOOL, listKnowledgeDocsHandler } from './list_knowledge_docs.js'
import { DELETE_KNOWLEDGE_DOC_TOOL, deleteKnowledgeDocHandler } from './delete_knowledge_doc.js'
import { ASSOCIATE_KNOWLEDGE_TOOL, associateKnowledgeHandler } from './associate_knowledge.js'

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
  SWITCH_TENANT_TOOL,
  EXPORT_AGENT_JSON_TOOL,
  IMPORT_AGENT_JSON_TOOL,
  LIST_TEMPLATES_TOOL,
  CREATE_FROM_TEMPLATE_TOOL,
  EXAMPLE_AGENT_TOOL,
  DELETE_AGENT_TOOL,
  LIST_KNOWLEDGE_DOCS_TOOL,
  DELETE_KNOWLEDGE_DOC_TOOL,
  ASSOCIATE_KNOWLEDGE_TOOL,
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
  switch_tenant: switchTenantHandler,
  export_agent_json: exportAgentJsonHandler,
  import_agent_json: importAgentJsonHandler,
  list_templates: listTemplatesHandler,
  create_from_template: createFromTemplateHandler,
  example_agent: exampleAgentHandler as ToolHandler,
  delete_agent: deleteAgentHandler,
  list_knowledge_documents: listKnowledgeDocsHandler,
  delete_knowledge_document: deleteKnowledgeDocHandler,
  associate_knowledge_to_agent: associateKnowledgeHandler,
}
