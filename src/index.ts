#!/usr/bin/env node
/**
 * BotUyo MCP Server — Entry Point
 *
 * Usage (Claude Desktop / Cursor config):
 * {
 *   "mcpServers": {
 *     "botuyo": {
 *       "command": "node",
 *       "args": ["/path/to/packages/mcp/dist/index.js"],
 *       "env": {
 *         "BOTUYO_API_KEY": "pk_live_...",
 *         "BOTUYO_API_URL": "https://api.botuyo.com"  // optional, defaults to production
 *       }
 *     }
 *   }
 * }
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js'

import { BotuyoApiClient } from './client.js'
import { ALL_TOOLS, TOOL_HANDLERS } from './tools/index.js'

// ─── Config ────────────────────────────────────────────────────────────────────

const API_KEY = process.env.BOTUYO_API_KEY
const API_URL = process.env.BOTUYO_API_URL || 'https://api.botuyo.com'

if (!API_KEY) {
  console.error('[botuyo-mcp] Error: BOTUYO_API_KEY environment variable is required')
  process.exit(1)
}

// ─── Client ────────────────────────────────────────────────────────────────────

const client = new BotuyoApiClient({ apiKey: API_KEY, apiUrl: API_URL })

// ─── MCP Server ────────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'botuyo-mcp', version: '0.1.0' },
  { capabilities: { tools: {} } }
)

/** List all available MCP tools */
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: ALL_TOOLS
}))

/** Dispatch tool calls */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params
  const handler = TOOL_HANDLERS[name]

  if (!handler) {
    return {
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      isError: true
    }
  }

  try {
    const result = await handler(client, args || {})
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return {
      content: [{ type: 'text', text: `Error: ${msg}` }],
      isError: true
    }
  }
})

// ─── Start ─────────────────────────────────────────────────────────────────────

async function main() {
  // Verify credentials on startup
  try {
    const auth = await client.authenticate()
    console.error(`[botuyo-mcp] ✓ Connected to tenant "${auth.tenantName}" as ${auth.role}`)
    if (!auth.canWrite) {
      console.error('[botuyo-mcp] ⚠ Your role is viewer — write operations will be rejected')
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[botuyo-mcp] ✗ Auth failed: ${msg}`)
    process.exit(1)
  }

  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[botuyo-mcp] Server running via stdio')
}

main().catch((err) => {
  console.error('[botuyo-mcp] Fatal error:', err)
  process.exit(1)
})
