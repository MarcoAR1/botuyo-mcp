#!/usr/bin/env node
/**
 * @botuyo/mcp login command
 *
 * Usage: npx @botuyo/mcp login
 *
 * Flow:
 * 1. Prompts for email and password in the terminal
 * 2. Calls POST /api/auth/login to get a JWT
 * 3. Calls GET /api/auth/me to get the user's tenants
 * 4. If multiple tenants, asks the user to pick one
 * 5. If needed, calls POST /api/auth/switch-tenant
 * 6. Saves the credentials to ~/.botuyo/credentials.json
 */

import * as readline from 'readline'
import { readCredentials, saveCredentials, BotuyoCredentials } from './credentials.js'

const API_URL = process.env.BOTUYO_API_URL || 'https://api.botuyo.com'

export async function runLogin(args: string[]): Promise<void> {
  console.log('\n🤖 BotUyo MCP — Login\n')

  const existing = await readCredentials()
  if (existing && !args.includes('--force')) {
    const expired = existing.expiresAt && new Date(existing.expiresAt) < new Date()
    if (!expired) {
      console.log(`✅ Ya estás autenticado como: ${existing.email}`)
      console.log(`   Tenant: ${existing.tenantName} (${existing.role})`)
      console.log('\n   Usá --force para re-autenticarte.\n')
      return
    }
    console.log('⚠️  Tu sesión expiró. Vamos a re-autenticarte.\n')
  }

  // Prompt for email and password
  const email = await prompt('📧 Email: ')
  const password = await promptPassword('🔑 Password: ')

  if (!email || !password) {
    console.error('❌ Email y password son requeridos.')
    process.exit(1)
  }

  console.log('\n⏳ Autenticando...')

  // 1. Login
  const loginRes = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), password })
  })

  const loginData = (await loginRes.json()) as any
  if (!loginData.success) {
    console.error(`❌ Login fallido: ${loginData.error || 'Credenciales inválidas'}`)
    process.exit(1)
  }

  let token = loginData.data.token
  let tenantId = loginData.data.tenantId

  // 2. Get user info and tenants
  const meRes = await fetch(`${API_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  const meData = (await meRes.json()) as any

  if (!meData.success) {
    console.error(`❌ Error al obtener info del usuario: ${meData.error}`)
    process.exit(1)
  }

  const user = meData.data.user
  const tenantIds: string[] = user.tenantIds || []
  const roles: Array<{ tenantId: string; role: string }> = user.roles || []

  // 3. If multiple tenants, ask user to pick
  if (tenantIds.length > 1) {
    console.log(`\n📋 Tenés ${tenantIds.length} tenants disponibles:\n`)

    // Fetch tenant names for display
    const tenantInfos = await Promise.all(
      tenantIds.map(async (tid: string, i: number) => {
        const role = roles.find((r: any) => r.tenantId === tid)?.role || 'member'
        const isActive = tid === tenantId
        return { id: tid, role, isActive, index: i + 1 }
      })
    )

    for (const t of tenantInfos) {
      const marker = t.isActive ? ' ← actual' : ''
      console.log(`   ${t.index}. ${t.id} (${t.role})${marker}`)
    }

    const choice = await prompt('\n¿Qué tenant querés usar? (número, Enter para el actual): ')
    const choiceNum = parseInt(choice, 10)

    if (choice.trim() && choiceNum >= 1 && choiceNum <= tenantInfos.length) {
      const selectedTenant = tenantInfos[choiceNum - 1]
      if (selectedTenant.id !== tenantId) {
        // Switch tenant
        console.log(`\n⏳ Cambiando a tenant ${selectedTenant.id}...`)
        const switchRes = await fetch(`${API_URL}/api/auth/switch-tenant`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ tenantId: selectedTenant.id })
        })
        const switchData = (await switchRes.json()) as any
        if (!switchData.success) {
          console.error(`❌ Error al cambiar de tenant: ${switchData.error}`)
          process.exit(1)
        }
        token = switchData.data.token
        tenantId = selectedTenant.id
      }
    }
  }

  // 4. Get the role for the active tenant
  const activeRole = roles.find((r: any) => r.tenantId === tenantId)?.role || 'member'

  // 5. Save credentials
  // JWT from AuthService expires in 7 days
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const creds: BotuyoCredentials = {
    token,
    tenantId,
    tenantName: tenantId, // We'll update this with actual name below
    role: activeRole,
    email: email.trim(),
    savedAt: new Date().toISOString(),
    expiresAt
  }

  // Try to get the tenant name
  try {
    const tenantRes = await fetch(`${API_URL}/api/v1/tenants/${tenantId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const tenantData = (await tenantRes.json()) as any
    if (tenantData.success && tenantData.data?.name) {
      creds.tenantName = tenantData.data.name
    } else if (tenantData.data?.tenant?.name) {
      creds.tenantName = tenantData.data.tenant.name
    }
  } catch {
    // If we can't get the name, tenantId is fine
  }

  await saveCredentials(creds)

  console.log(`\n✅ ¡Autenticado exitosamente!`)
  console.log(`   Email:   ${creds.email}`)
  console.log(`   Tenant:  ${creds.tenantName}`)
  console.log(`   Role:    ${creds.role}`)
  console.log(`   Expira:  ${new Date(creds.expiresAt).toLocaleDateString()}`)
  console.log(`\n🚀 Ya podés usar el servidor MCP de BotUyo.\n`)
}

// ── Prompts ───────────────────────────────────────────────────────────────────

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

function promptPassword(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

    // Attempt to hide input on supported terminals
    if (process.stdin.isTTY) {
      process.stdout.write(question)
      const stdin = process.stdin
      stdin.setRawMode(true)
      stdin.resume()
      stdin.setEncoding('utf8')

      let password = ''
      const onData = (ch: string) => {
        const c = ch.toString()
        switch (c) {
          case '\n':
          case '\r':
          case '\u0004': // Ctrl+D
            stdin.setRawMode(false)
            stdin.pause()
            stdin.removeListener('data', onData)
            rl.close()
            process.stdout.write('\n')
            resolve(password)
            break
          case '\u0003': // Ctrl+C
            process.exit()
            break
          case '\u007F': // Backspace
            if (password.length > 0) {
              password = password.slice(0, -1)
              process.stdout.clearLine(0)
              process.stdout.cursorTo(0)
              process.stdout.write(question + '*'.repeat(password.length))
            }
            break
          default:
            password += c
            process.stdout.write('*')
            break
        }
      }
      stdin.on('data', onData)
    } else {
      // Non-TTY fallback (piped input)
      rl.question(question, (answer) => {
        rl.close()
        resolve(answer)
      })
    }
  })
}
