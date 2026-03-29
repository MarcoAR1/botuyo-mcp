#!/usr/bin/env node
/**
 * @botuyo/mcp switch-tenant command
 *
 * Usage: npx @botuyo/mcp switch-tenant
 *
 * Lists the user's tenants and lets them pick a different one.
 * Calls POST /api/auth/switch-tenant and saves the new JWT.
 */

import * as readline from 'readline'
import { readCredentials, saveCredentials, resolveToken, resolveApiUrl, fetchUserInfo, resolveTenantName } from './credentials.js'

export async function runSwitchTenant(): Promise<void> {
  console.log('\n🔄 BotUyo MCP — Switch Tenant\n')

  const token = await resolveToken()
  const creds = await readCredentials()
  const API_URL = await resolveApiUrl()

  if (!token || !creds) {
    console.error('❌ No estás autenticado. Ejecutá: npx @botuyo/mcp auth (browser) o npx @botuyo/mcp login (terminal)')
    process.exit(1)
  }

  // Get user's tenants
  let userInfo
  try {
    userInfo = await fetchUserInfo(API_URL, token)
  } catch (err: any) {
    console.error(`❌ Sesión inválida: ${err.message || 'Token expirado'}`)
    console.error('   Ejecutá: npx @botuyo/mcp auth (browser) o npx @botuyo/mcp login (terminal)')
    process.exit(1)
  }

  const { tenantIds, roles } = userInfo

  if (tenantIds.length === 0) {
    console.log('No tenés tenants disponibles.')
    return
  }

  if (tenantIds.length === 1) {
    console.log(`Solo tenés un tenant: ${creds.tenantName} (${creds.role})`)
    console.log('No hay nada para cambiar.\n')
    return
  }

  console.log(`Tenés ${tenantIds.length} tenants disponibles:\n`)

  // Fetch tenant names for display
  const tenantInfos = await Promise.all(
    tenantIds.map(async (tid: string, i: number) => {
      const role = roles.find((r: any) => r.tenantId === tid)?.role || 'member'
      const isActive = tid === creds.tenantId
      let name = isActive ? (creds.tenantName || tid) : tid
      if (name === tid) {
        name = await resolveTenantName(API_URL, token, tid)
      }
      return { id: tid, name, role, isActive, index: i + 1 }
    })
  )

  for (const t of tenantInfos) {
    const marker = t.isActive ? ' ← actual' : ''
    console.log(`   ${t.index}. ${t.name} (${t.role})${marker}`)
  }

  const choice = await prompt('\n¿A qué tenant querés cambiar? (número): ')
  const choiceNum = parseInt(choice, 10)

  if (!choiceNum || choiceNum < 1 || choiceNum > tenantIds.length) {
    console.log('Operación cancelada.')
    return
  }

  const selectedTenant = tenantInfos[choiceNum - 1]
  const selectedTenantId = selectedTenant.id
  if (selectedTenantId === creds.tenantId) {
    console.log('\nYa estás en ese tenant. No hubo cambios.\n')
    return
  }

  console.log(`\n⏳ Cambiando a tenant ${selectedTenant.name}...`)

  const switchRes = await fetch(`${API_URL}/api/auth/switch-tenant`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ tenantId: selectedTenantId })
  })
  const switchData = (await switchRes.json()) as any

  if (!switchData.success) {
    console.error(`❌ Error al cambiar de tenant: ${switchData.error}`)
    process.exit(1)
  }

  const newToken = switchData.data.token
  const newRole = switchData.data.user?.role || roles.find((r: any) => r.tenantId === selectedTenantId)?.role || 'member'

  const tenantName = await resolveTenantName(API_URL, newToken, selectedTenantId)

  await saveCredentials({
    ...creds,
    token: newToken,
    tenantId: selectedTenantId,
    tenantName,
    role: newRole,
    savedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  })

  console.log(`\n✅ Cambiado exitosamente`)
  console.log(`   Tenant:  ${tenantName}`)
  console.log(`   Role:    ${newRole}\n`)
}

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}
