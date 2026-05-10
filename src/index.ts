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
import { BotuyoApiClient, ApiError } from './client.js'
import { ALL_TOOLS, TOOL_HANDLERS } from './tools/index.js'
import { resolveToken, readCredentials, clearCredentials, isTokenExpired, resolveApiUrl } from './commands/credentials.js'
import { watch, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

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
      console.log(`API:      ${creds.apiUrl || '(no guardada — se usará default)'}`)
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
  // Resolve JWT token and API URL — server starts regardless of auth state
  const token = await resolveToken()
  const apiUrl = await resolveApiUrl()
  let authenticated = false
  let client: BotuyoApiClient | null = null

  if (!token) {
    const expired = await isTokenExpired()
    if (expired) {
      console.error('[botuyo-mcp] ⚠ Tu sesión expiró. Ejecutá: npx @botuyo/mcp login')
    } else {
      console.error('[botuyo-mcp] ⚠ No hay credenciales. Ejecutá: npx @botuyo/mcp login')
    }
  } else {
    const creds = await readCredentials()
    client = new BotuyoApiClient({ token, apiUrl })
    // Restore active tenant from prior switch_tenant session
    if (creds?.tenantId) client.setToken(token, creds.tenantId)
    console.error(`[botuyo-mcp] API: ${apiUrl}`)

    try {
      const auth = await client.verify()
      const tenantName = creds?.tenantName || auth.tenantId
      const role = creds?.role || auth.role
      console.error(`[botuyo-mcp] ✓ Conectado a "${tenantName}" como ${role}`)
      authenticated = true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[botuyo-mcp] ⚠ Auth failed: ${msg}`)
      console.error('[botuyo-mcp] Las tools pedirán re-autenticación. Ejecutá: npx @botuyo/mcp login')
    }
  }

  const AUTH_ERROR_MSG = 'No autenticado. El usuario debe ejecutar: npx @botuyo/mcp login'

  // ── Hot-reload: try to authenticate from disk credentials ─────────────
  async function tryHotReload(): Promise<boolean> {
    const freshToken = await resolveToken()
    if (!freshToken) return false

    const freshCreds = await readCredentials()
    const freshApiUrl = freshCreds?.apiUrl || apiUrl

    // Create or update client
    if (!client) {
      client = new BotuyoApiClient({ token: freshToken, apiUrl: freshApiUrl })
    } else {
      client.setToken(freshToken, freshCreds?.tenantId)
    }

    try {
      const auth = await client.verify()
      const tenantName = freshCreds?.tenantName || auth.tenantId
      const role = freshCreds?.role || auth.role
      console.error(`[botuyo-mcp] 🔄 Hot-reload: conectado a "${tenantName}" como ${role}`)
      authenticated = true
      return true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[botuyo-mcp] 🔄 Hot-reload: auth failed: ${msg}`)
      return false
    }
  }

  // ── Watch credentials file for changes (auto-restart on login/auth) ───
  watchCredentialsFile(async () => {
    console.error('[botuyo-mcp] 🔄 Credentials file changed — reloading authentication...')
    await tryHotReload()
  })

  // ── MCP Server — starts ALWAYS, even without valid auth ────────────────
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

    // Guard: if not authenticated, attempt hot-reload from disk before rejecting
    if (!authenticated || !client) {
      const reloaded = await tryHotReload()
      if (!reloaded || !client) {
        return { content: [{ type: 'text', text: AUTH_ERROR_MSG }], isError: true }
      }
    }

    try {
      const result = await handler(client, args || {})
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    } catch (error: unknown) {
      // Detect expired token via ApiError.status (reliable) or message fallback
      const is401 = (error instanceof ApiError && error.status === 401) ||
        (error instanceof Error && (error.message.includes('401') || error.message.includes('expirada') || error.message.includes('expired')))

      if (is401) {
        // Try to reload credentials from disk (user may have re-authenticated)
        const freshToken = await resolveToken()
        if (freshToken && freshToken !== client.getToken()) {
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

      const msg = error instanceof Error ? error.message : String(error)
      return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true }
    }
  })

  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[botuyo-mcp] Server running via stdio')
}

// ── Credentials file watcher ─────────────────────────────────────────────────
// Watches ~/.botuyo/credentials.json for changes. When the user runs `login` or
// `auth` in a separate terminal, the file is written and we auto-reload auth.
// Uses a debounce to handle rapid/duplicate fs events on Windows.

function watchCredentialsFile(onChanged: () => void): void {
  const configDir = join(homedir(), '.botuyo')
  const credFile = join(configDir, 'credentials.json')

  // Ensure the directory exists (login may not have run yet)
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true })
  }

  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  try {
    // Watch the directory (more reliable than watching a file that may not exist)
    watch(configDir, (eventType, filename) => {
      if (filename !== 'credentials.json') return

      // Debounce: fs.watch fires multiple events per write on Windows
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        onChanged()
      }, 500)
    })
    console.error(`[botuyo-mcp] 👁 Watching ${credFile} for auth changes`)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[botuyo-mcp] ⚠ Could not watch credentials file: ${msg}`)
  }
}

main().catch((err) => {
  console.error('[botuyo-mcp] Fatal error:', err)
  process.exit(1)
})

