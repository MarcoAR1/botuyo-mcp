#!/usr/bin/env node
/**
 * @botuyo/mcp auth command (Browser OAuth flow)
 *
 * Usage: npx @botuyo/mcp auth
 *
 * Flow:
 * 1. Starts a local HTTP server on a random port
 * 2. Opens admin.botuyo.com/mcp-auth?redirect=http://localhost:PORT
 * 3. The admin panel authenticates the user (login/Google),
 *    calls POST /api/v1/mcp/oauth/authorize, then redirects to localhost with ?code=...
 * 4. CLI exchanges the code for a JWT directly (POST /api/v1/mcp/oauth/token)
 * 5. Saves the JWT to ~/.botuyo/credentials.json
 *
 * For terminal-only login (email/password), use `npx @botuyo/mcp login` instead.
 */

import http from 'http'
import { URL } from 'url'
import { execSync } from 'child_process'
import { readCredentials, saveCredentials, BotuyoCredentials } from './credentials.js'
import os from 'os'

const ADMIN_URL = process.env.BOTUYO_ADMIN_URL || 'https://admin.botuyo.com'
const API_URL = process.env.BOTUYO_API_URL || 'https://api.botuyo.com'

export async function runAuth(args: string[]): Promise<void> {
  console.log('\n🤖 BotUyo MCP — Autenticación por Browser\n')

  const existing = await readCredentials()
  if (existing && !args.includes('--force')) {
    const expired = existing.expiresAt && new Date(existing.expiresAt) < new Date()
    if (!expired) {
      console.log(`✅ Ya estás autenticado como: ${existing.email || 'usuario'}`)
      console.log(`   Tenant: ${existing.tenantName} (${existing.role})`)
      console.log('\n   Usá --force para re-autenticarte.')
      console.log('   O usá `npx @botuyo/mcp login` para login por terminal.\n')
      return
    }
    console.log('⚠️  Tu sesión expiró. Vamos a re-autenticarte.\n')
  }

  // Start local callback server
  const { port, waitForCode } = await startCallbackServer()
  const redirectUri = `http://localhost:${port}/callback`
  const deviceName = encodeURIComponent(`${os.hostname()} CLI`)

  const authUrl = `${ADMIN_URL}/mcp-auth?redirect=${encodeURIComponent(redirectUri)}&device=${deviceName}`

  console.log(`📋 Abriendo browser para autorizar...\n   ${authUrl}\n`)
  openBrowser(authUrl)
  console.log('Esperando autorización (10 minutos máximo)...\n')

  const code = await waitForCode
  if (!code) {
    console.error('❌ La autorización expiró o fue cancelada.')
    process.exit(1)
  }

  console.log('✅ Código recibido! Obteniendo sesión...')

  // Exchange code for JWT directly (no API key intermediate)
  const tokenRes = await fetch(`${API_URL}/api/v1/mcp/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, name: `${os.hostname()} CLI` })
  })
  const tokenData = (await tokenRes.json()) as any

  if (!tokenData.success) {
    console.error(`❌ Error: ${tokenData.error}`)
    process.exit(1)
  }

  const creds: BotuyoCredentials = {
    token: tokenData.data.token,
    tenantId: tokenData.data.tenantId,
    tenantName: tokenData.data.tenantName || tokenData.data.tenantId,
    role: tokenData.data.role || 'viewer',
    email: tokenData.data.callerEmail || '',
    savedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
  }

  await saveCredentials(creds)

  console.log(`\n✅ ¡Autenticado exitosamente!`)
  console.log(`   Tenant:  ${creds.tenantName}`)
  console.log(`   Role:    ${creds.role}`)
  console.log(`   Email:   ${creds.email || '(no disponible)'}`)
  console.log(`   Expira:  ${new Date(creds.expiresAt).toLocaleDateString()}`)
  console.log(`\n🚀 Ya podés usar el servidor MCP de BotUyo.\n`)
}

// ── Local callback server ─────────────────────────────────────────────────────
function startCallbackServer(): Promise<{ port: number; waitForCode: Promise<string | null> }> {
  return new Promise((resolve) => {
    let resolveCode: (code: string | null) => void

    const waitForCode = new Promise<string | null>((res) => {
      resolveCode = res
    })

    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://localhost`)

      if (url.pathname === '/callback') {
        const code = url.searchParams.get('code')

        const html = code
          ? `<html><body style="font-family:sans-serif;text-align:center;padding:80px">
              <h2>✅ BotUyo CLI Autorizado</h2>
              <p>Podés cerrar esta pestaña y volver a la terminal.</p>
             </body></html>`
          : `<html><body style="font-family:sans-serif;text-align:center;padding:80px">
              <h2>❌ Autorización fallida</h2>
              <p>No se recibió el código. Intentá de nuevo.</p>
             </body></html>`

        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(html)

        server.close()
        resolveCode!(code)
      } else {
        res.writeHead(404)
        res.end()
      }
    })

    server.listen(0, 'localhost', () => {
      const port = (server.address() as any).port
      setTimeout(() => { server.close(); resolveCode!(null) }, 10 * 60 * 1000)
      resolve({ port, waitForCode })
    })
  })
}

// ── Open browser cross-platform ───────────────────────────────────────────────
function openBrowser(url: string): void {
  const platform = process.platform
  try {
    if (platform === 'win32') execSync(`start "" "${url}"`, { stdio: 'ignore' })
    else if (platform === 'darwin') execSync(`open "${url}"`, { stdio: 'ignore' })
    else execSync(`xdg-open "${url}"`, { stdio: 'ignore' })
  } catch {
    console.log(`   No se pudo abrir el browser automáticamente. Visitá:\n   ${url}\n`)
  }
}
