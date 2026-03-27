#!/usr/bin/env node
/**
 * @botuyo/mcp — Entry Point
 *
 * Sub-commands:
 *   npx @botuyo/mcp login         — Login with email/password (terminal)
 *   npx @botuyo/mcp auth          — Login via browser OAuth (recommended)
 *   npx @botuyo/mcp tenants       — List your tenants
 *   npx @botuyo/mcp switch-tenant — Switch active tenant
 *   npx @botuyo/mcp setup         — Generate mcp.json for your editor
 *   npx @botuyo/mcp whoami        — Show current credentials
 *   npx @botuyo/mcp logout        — Clear stored credentials
 *   npx @botuyo/mcp               — Start the MCP server (default)
 *
 * Token resolution (in priority order):
 *   1. BOTUYO_TOKEN env var
 *   2. ~/.botuyo/credentials.json (saved by `login` or `auth`)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { BotuyoApiClient } from './client.js'
import { ALL_TOOLS, TOOL_HANDLERS } from './tools/index.js'
import { resolveToken, readCredentials, clearCredentials, isTokenExpired } from './commands/credentials.js'

const API_URL = process.env.BOTUYO_API_URL || 'https://api.botuyo.com'

// ─── Sub-command routing ──────────────────────────────────────────────────────

const [, , cmd, ...rest] = process.argv

async function main() {
  switch (cmd) {
    // ── login ──────────────────────────────────────────────────────────────
    case 'login': {
      const { runLogin } = await import('./commands/login.js')
      await runLogin(rest)
      return
    }

    // ── auth (browser OAuth flow) ────────────────────────────────────────
    case 'auth': {
      const { runAuth } = await import('./commands/auth.js')
      await runAuth(rest)
      return
    }

    // ── tenants ────────────────────────────────────────────────────────────
    case 'tenants': {
      const { runTenants } = await import('./commands/tenants.js')
      await runTenants()
      return
    }

    // ── switch-tenant ─────────────────────────────────────────────────────
    case 'switch-tenant': {
      const { runSwitchTenant } = await import('./commands/switch_tenant.js')
      await runSwitchTenant()
      return
    }

    // ── setup ──────────────────────────────────────────────────────────────
    case 'setup': {
      const { runSetup } = await import('./commands/setup.js')
      await runSetup(rest)
      return
    }

    // ── whoami ─────────────────────────────────────────────────────────────
    case 'whoami': {
      const token = await resolveToken()
      const creds = await readCredentials()
      if (!token || !creds) {
        console.log('No estás autenticado. Ejecutá: npx @botuyo/mcp auth (browser) o npx @botuyo/mcp login (terminal)')
        return
      }
      const expired = await isTokenExpired()
      console.log(`Email:    ${creds.email}`)
      console.log(`Tenant:   ${creds.tenantName}`)
      console.log(`Role:     ${creds.role}`)
      console.log(`Expira:   ${new Date(creds.expiresAt).toLocaleDateString()}`)
      console.log(`Estado:   ${expired ? '❌ Expirado — ejecutá: npx @botuyo/mcp auth (browser) o npx @botuyo/mcp login (terminal)' : '✅ Activo'}`)
      return
    }

    // ── logout ─────────────────────────────────────────────────────────────
    case 'logout': {
      await clearCredentials()
      console.log('✅ Sesión cerrada.')
      return
    }

    // ── default: start MCP server ──────────────────────────────────────────
    default: {
      await startMcpServer()
    }
  }
}

async function startMcpServer() {
  // Resolve JWT token
  const token = await resolveToken()

  if (!token) {
    const expired = await isTokenExpired()
    if (expired) {
      console.error('[botuyo-mcp] Error: Tu sesión expiró.')
    } else {
      console.error('[botuyo-mcp] Error: No hay credenciales guardadas.')
    }
    console.error('[botuyo-mcp] Ejecutá `npx @botuyo/mcp auth` (browser) o `npx @botuyo/mcp login` (terminal) para autenticarte.')
    process.exit(1)
  }

  const creds = await readCredentials()
  const client = new BotuyoApiClient({ token, apiUrl: API_URL })

  // Verify credentials on startup
  try {
    const auth = await client.verify()
    const tenantName = creds?.tenantName || auth.tenantId
    const role = creds?.role || auth.role
    console.error(`[botuyo-mcp] ✓ Conectado a "${tenantName}" como ${role}`)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[botuyo-mcp] ✗ Auth failed: ${msg}`)
    await clearCredentials()
    console.error('[botuyo-mcp] Ejecutá `npx @botuyo/mcp auth` (browser) o `npx @botuyo/mcp login` (terminal) para re-autenticarte.')
    process.exit(1)
  }

  // ── MCP Server ─────────────────────────────────────────────────────────
  const server = new Server(
    { name: 'botuyo-mcp', version: '0.3.0' },
    { capabilities: { tools: {} } }
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: ALL_TOOLS }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    const handler = TOOL_HANDLERS[name]

    if (!handler) {
      return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true }
    }

    try {
      const result = await handler(client, args || {})
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)

      // Detect expired token — try to reload credentials from disk (user may have re-authenticated)
      if (msg.includes('401') || msg.includes('expirada') || msg.includes('expired')) {
        const freshToken = await resolveToken()
        if (freshToken && freshToken !== client.getToken()) {
          // New credentials found on disk — hot-swap and retry once
          client.setToken(freshToken)
          console.error('[botuyo-mcp] ✓ Credenciales recargadas desde disco, reintentando...')
          try {
            const retryResult = await handler(client, args || {})
            return { content: [{ type: 'text', text: JSON.stringify(retryResult, null, 2) }] }
          } catch (retryError: unknown) {
            const retryMsg = retryError instanceof Error ? retryError.message : String(retryError)
            return { content: [{ type: 'text', text: `Error tras reintentar: ${retryMsg}` }], isError: true }
          }
        }

        return {
          content: [{ type: 'text', text: `Sesión expirada. El usuario debe ejecutar en su terminal: npx @botuyo/mcp auth (browser OAuth) o npx @botuyo/mcp login (email/password)` }],
          isError: true
        }
      }

      return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true }
    }
  })

  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[botuyo-mcp] Server running via stdio')
}

main().catch((err) => {
  console.error('[botuyo-mcp] Fatal error:', err)
  process.exit(1)
})
