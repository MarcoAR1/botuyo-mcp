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
import { readCredentials, saveCredentials, resolveToken } from './credentials.js'

const API_URL = process.env.BOTUYO_API_URL || 'https://api.botuyo.com'

export async function runSwitchTenant(): Promise<void> {
  console.log('\n🔄 BotUyo MCP — Switch Tenant\n')

  const token = await resolveToken()
  const creds = await readCredentials()

  if (!token || !creds) {
    console.error('❌ No estás autenticado. Ejecutá: npx @botuyo/mcp login')
    process.exit(1)
  }

  // Get user's tenants
  const meRes = await fetch(`${API_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  const meData = (await meRes.json()) as any

  if (!meData.success) {
    console.error(`❌ Sesión inválida: ${meData.error || 'Token expirado'}`)
    console.error('   Ejecutá: npx @botuyo/mcp login')
    process.exit(1)
  }

  const user = meData.data.user
  const tenantIds: string[] = user.tenantIds || []
  const roles: Array<{ tenantId: string; role: string }> = user.roles || []

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

  for (let i = 0; i < tenantIds.length; i++) {
    const tid = tenantIds[i]
    const role = roles.find((r: any) => r.tenantId === tid)?.role || 'member'
    const isActive = tid === creds.tenantId
    const marker = isActive ? ' ← actual' : ''
    console.log(`   ${i + 1}. ${tid} (${role})${marker}`)
  }

  const choice = await prompt('\n¿A qué tenant querés cambiar? (número): ')
  const choiceNum = parseInt(choice, 10)

  if (!choiceNum || choiceNum < 1 || choiceNum > tenantIds.length) {
    console.log('Operación cancelada.')
    return
  }

  const selectedTenantId = tenantIds[choiceNum - 1]
  if (selectedTenantId === creds.tenantId) {
    console.log('\nYa estás en ese tenant. No hubo cambios.\n')
    return
  }

  console.log(`\n⏳ Cambiando a tenant ${selectedTenantId}...`)

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

  // Try to get tenant name
  let tenantName = selectedTenantId
  try {
    const tenantRes = await fetch(`${API_URL}/api/v1/tenants/${selectedTenantId}`, {
      headers: { Authorization: `Bearer ${newToken}` }
    })
    const tenantData = (await tenantRes.json()) as any
    if (tenantData.success && tenantData.data?.name) {
      tenantName = tenantData.data.name
    } else if (tenantData.data?.tenant?.name) {
      tenantName = tenantData.data.tenant.name
    }
  } catch {
    // use tenantId
  }

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
