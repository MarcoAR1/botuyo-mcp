import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'
import { writeFileSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'
import { exportAgentFamilyHandler } from './agent_families.js'

export const EXPORT_AGENT_JSON_TOOL: Tool = {
  name: 'export_agent_json',
  description: `Export an agent's configuration as clean, editable JSON.

Unified model: if the agent belongs to a family (the normal case — every agent created
via create_agent is a family-of-one), this exports the WHOLE logical agent as a portable
FOLDER ({slug}/family.json + variants/<key>.json; a simple agent has exactly one variant
file) — identical to export_agent_family. Re-import with import_agent_json or import_agent_family.

For a legacy standalone agent (e.g. module-managed) it falls back to a single flat JSON file:

Returns the complete agentConfig including identity, stages, connections (graph edges),
channelFlows, enabledTools, channels, widgetConfig, voice, and all other settings.
Also includes apiKey (read-only) for external integrations.

The exported JSON is automatically saved to a local file for easy editing:
- Default: saves to ./agents/{agent-name}.json in the current working directory
- Custom: use savePath to specify a different directory

Use import_agent_json to re-import after editing.`,
  inputSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string', description: 'The MongoDB ID of the agent to export' },
      savePath: { type: 'string', description: 'Optional. Directory path where the JSON file will be saved. Default: ./agents/' }
    },
    required: ['agentId']
  }
}

export async function exportAgentJsonHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  const agentId = args.agentId as string

  // Unified model: if this agent belongs to a family (incl. a backfilled family-of-1),
  // export the whole logical agent in the uniform folder layout (simple = 1 variant file).
  const agentRes = (await client.get(`/api/v1/mcp/agents/${agentId}`)) as { data?: { familyId?: string | null } }
  const familyId = agentRes?.data?.familyId
  if (familyId) {
    return exportAgentFamilyHandler(client, { familyId, ...(args.savePath ? { savePath: args.savePath } : {}) })
  }

  // Legacy standalone (module-managed / pre-backfill): original single-file export.
  const savePath = (args.savePath as string) || './agents'

  const result = await client.get(`/api/v1/mcp/agents/${agentId}/export`) as any

  // Auto-save to local file
  if (result?.success && result?.data?.agentConfig) {
    try {
      const agentName = result.data.agentConfig.name || agentId
      // Sanitize filename: replace special chars, lowercase
      const sanitizedName = agentName
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '_')
        .toLowerCase()
        .substring(0, 50)
      const fileName = `${sanitizedName}.json`

      const dir = resolve(savePath)
      mkdirSync(dir, { recursive: true })

      const filePath = join(dir, fileName)
      const exportPayload = {
        _exportedAt: new Date().toISOString(),
        _agentId: result.data.agentId,
        _apiKey: result.data.apiKey,
        ...result.data.agentConfig
      }

      writeFileSync(filePath, JSON.stringify(exportPayload, null, 2), 'utf-8')

      result.savedTo = filePath
      result.message = `${result.message || ''} File saved to: ${filePath}`
    } catch (err: any) {
      result.fileSaveError = `Could not save file: ${err.message}`
    }
  }

  return result
}
