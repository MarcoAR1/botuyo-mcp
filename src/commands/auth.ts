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
import { readCredentials, saveCredentials, clearCredentials, verifyTokenWithServer, BotuyoCredentials } from './credentials.js'
import os from 'os'

const ADMIN_URL = process.env.BOTUYO_ADMIN_URL || 'https://botuyo.com'
const API_URL = process.env.BOTUYO_API_URL || 'https://api.botuyo.com'

export async function runAuth(args: string[]): Promise<void> {
  console.log('\n🤖 BotUyo MCP — Autenticación por Browser\n')

  const existing = await readCredentials()
  if (existing && !args.includes('--force')) {
    const localExpired = existing.expiresAt && new Date(existing.expiresAt) < new Date()
    if (localExpired) {
      await clearCredentials()
      console.log('⚠️  Tu sesión expiró. Vamos a re-autenticarte.\n')
    } else {
      // Verify token is still valid on server
      const valid = await verifyTokenWithServer(existing.token, API_URL)
      if (valid) {
        console.log(`✅ Ya estás autenticado como: ${existing.email || 'usuario'}`)
        console.log(`   Tenant: ${existing.tenantName} (${existing.role})`)
        console.log('\n   Usá --force para re-autenticarte.')
        console.log('   O usá `npx @botuyo/mcp login` para login por terminal.\n')
        return
      }
      console.log('⚠️  Tu sesión ya no es válida en el servidor. Vamos a re-autenticarte.\n')
    }
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

  // Resolve the real tenant name via API (OAuth response often only has the ID)
  if (creds.tenantName === creds.tenantId) {
    try {
      const tRes = await fetch(`${API_URL}/api/v1/tenants/${creds.tenantId}`, {
        headers: { Authorization: `Bearer ${creds.token}` }
      })
      const tData = (await tRes.json()) as any
      const name = tData.data?.name || tData.data?.tenant?.name
      if (name) creds.tenantName = name
    } catch { /* keep ID as fallback */ }
  }

  await saveCredentials(creds)

  console.log(`\n✅ ¡Autenticado exitosamente!`)
  console.log(`   Tenant:  ${creds.tenantName}`)
  console.log(`   Role:    ${creds.role}`)
  console.log(`   Email:   ${creds.email || '(no disponible)'}`)
  console.log(`   Expira:  ${new Date(creds.expiresAt).toLocaleDateString()}`)
  console.log(`\n🚀 Ya podés usar el servidor MCP de BotUyo.\n`)
  process.exit(0)
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
          ? `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
             <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet">
             <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Plus Jakarta Sans',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#f8fafc,#eef2ff,#f8fafc);color:#0f172a}
             .card{text-align:center;max-width:420px;padding:48px 32px;background:#fff;border-radius:20px;border:1px solid #e2e8f0;box-shadow:0 25px 50px rgba(0,0,0,.08)}
             .icon{width:64px;height:64px;margin:0 auto 20px;background:#f0fdf4;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:28px}
             h2{font-size:22px;font-weight:700;margin-bottom:8px}p{color:#64748b;font-size:15px;line-height:1.6}
             .badge{display:inline-block;margin-top:16px;background:#eef2ff;color:#4f46e5;padding:6px 16px;border-radius:8px;font-size:13px;font-weight:600}</style></head>
             <body><div class="card"><div class="icon">✅</div><h2>BotUyo CLI Autorizado</h2>
             <p>Podés cerrar esta pestaña y volver a la terminal.</p>
             <span class="badge">Sesión activa</span></div></body></html>`
          : `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
             <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet">
             <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Plus Jakarta Sans',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#f8fafc,#fff1f2,#f8fafc);color:#0f172a}
             .card{text-align:center;max-width:420px;padding:48px 32px;background:#fff;border-radius:20px;border:1px solid #e2e8f0;box-shadow:0 25px 50px rgba(0,0,0,.08)}
             .icon{width:64px;height:64px;margin:0 auto 20px;background:#fef2f2;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:28px}
             h2{font-size:22px;font-weight:700;margin-bottom:8px}p{color:#64748b;font-size:15px;line-height:1.6}
             code{background:#f1f5f9;padding:2px 8px;border-radius:4px;font-size:13px}</style></head>
             <body><div class="card"><div class="icon">❌</div><h2>Autorización fallida</h2>
             <p>No se recibió el código. Ejecutá <code>npx @botuyo/mcp auth</code> de nuevo.</p></div></body></html>`

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
