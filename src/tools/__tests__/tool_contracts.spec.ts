import { describe, it, expect, vi } from 'vitest'
import { GET_TOOLS_CATALOG_TOOL, getToolsCatalogHandler } from '../list_base_tools.js'
import { CONFIGURE_AGENT_TOOL, configureAgentToolHandler } from '../configure_agent_tool.js'
import { assertToolInput, formatToolResult } from '../../toolProtocol.js'
import { UPDATE_AGENT_TOOL } from '../update_agent.js'
import { ALL_TOOLS } from '../index.js'
import { Ajv } from 'ajv'

describe('tool contracts', () => {
  it('preserves documented null deletion in update_agent', () => {
    expect(() => assertToolInput(UPDATE_AGENT_TOOL, { agentId: 'a', widgetConfig: { logoUrl: null }, voice: null })).not.toThrow()
  })
  it('publishes valid schemas for every registered MCP tool', () => {
    const ajv = new Ajv({ strict: false, validateFormats: false })
    for (const tool of ALL_TOOLS) {
      expect(() => ajv.compile(tool.inputSchema), tool.name).not.toThrow()
      if (tool.outputSchema) expect(() => ajv.compile(tool.outputSchema!), tool.name).not.toThrow()
    }
  })
  it('preserves the complete catalog and schema metadata', async () => {
    const tools = [{ name: 'navigate_to', description: 'x'.repeat(180), configurationSchema: { properties: { destinations: { items: { required: ['id', 'path'] } } } } }]
    const client = { get: vi.fn(async () => ({ success: true, data: tools })) }
    const result = await getToolsCatalogHandler(client as any, {})
    expect(result).toMatchObject({ tools })
    expect(result.text).toContain('x'.repeat(180))
  })
  it('rejects invalid typed fields before an API write', async () => {
    const client = { put: vi.fn() }
    await expect(configureAgentToolHandler(client as any, { agentId: 'a', toolName: 'x', fields: [{ name: 'count', type: 'wrong', label: 'Count', required: true }] })).rejects.toThrow()
    expect(client.put).not.toHaveBeenCalled()
  })
  it('validates catalog filters and field enums with the published input schema', () => {
    expect(() => assertToolInput(GET_TOOLS_CATALOG_TOOL, { filter: 'typo' })).toThrow()
    expect(() => assertToolInput(CONFIGURE_AGENT_TOOL, { agentId: 'a', toolName: 'x', fields: [{ name: 'choice', type: 'enum', label: 'Choice', required: true }] })).toThrow()
  })
  it('returns structured results and treats business errors as MCP errors', () => {
    expect(formatToolResult(GET_TOOLS_CATALOG_TOOL, { text: 'Catalog', tools: [] })).toMatchObject({ structuredContent: { text: 'Catalog', tools: [] }, content: [{ type: 'text' }] })
    expect(formatToolResult(CONFIGURE_AGENT_TOOL, { success: false, error: 'Conflict' }).isError).toBe(true)
  })
  it('enforces declared output schemas', () => {
    expect(() => formatToolResult(GET_TOOLS_CATALOG_TOOL, { text: 'Missing tools' })).toThrow()
  })
})
