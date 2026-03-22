#!/usr/bin/env node
/**
 * @botuyo/mcp tenants command
 *
 * Usage: npx @botuyo/mcp tenants
 *
 * Lists all tenants the current user belongs to with their roles.
 */

import { readCredentials, resolveToken } from './credentials.js'

const API_URL = process.env.BOTUYO_API_URL || 'https://api.botuyo.com'

export async function runTenants(): Promise<void> {
  console.log('\n📋 BotUyo MCP — Mis Tenants\n')

  const token = await resolveToken()
  const creds = await readCredentials()

  if (!token || !creds) {
    console.error('❌ No estás autenticado. Ejecutá: npx @botuyo/mcp login')
    process.exit(1)
  }

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
    console.log('No tenés tenants disponibles.\n')
    return
  }

  console.log(`Email: ${creds.email}`)
  console.log(`Tenants: ${tenantIds.length}\n`)
  console.log('  #   Tenant ID                           Rol        Estado')
  console.log('  ─   ─────────────────────────────────   ─────────  ──────')

  for (let i = 0; i < tenantIds.length; i++) {
    const tid = tenantIds[i]
    const role = roles.find((r: any) => r.tenantId === tid)?.role || 'member'
    const isActive = tid === creds.tenantId
    const status = isActive ? '✓ activo' : ''
    console.log(`  ${i + 1}   ${tid.padEnd(37)} ${role.padEnd(10)} ${status}`)
  }

  console.log(`\nPara cambiar de tenant: npx @botuyo/mcp switch-tenant\n`)
}
