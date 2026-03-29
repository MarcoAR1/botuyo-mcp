#!/usr/bin/env node
/**
 * @botuyo/mcp tenants command
 *
 * Usage: npx @botuyo/mcp tenants
 *
 * Lists all tenants the current user belongs to with their roles.
 */

import { readCredentials, resolveToken, resolveApiUrl, fetchUserInfo, resolveTenantName } from './credentials.js'

export async function runTenants(): Promise<void> {
  console.log('\n📋 BotUyo MCP — Mis Tenants\n')

  const token = await resolveToken()
  const creds = await readCredentials()
  const API_URL = await resolveApiUrl()

  if (!token || !creds) {
    console.error('❌ No estás autenticado. Ejecutá: npx @botuyo/mcp auth (browser) o npx @botuyo/mcp login (terminal)')
    process.exit(1)
  }

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
    console.log('No tenés tenants disponibles.\n')
    return
  }

  console.log(`Email: ${creds.email}`)
  console.log(`Tenants: ${tenantIds.length}\n`)
  console.log('  #   Nombre                              Rol        Estado')
  console.log('  ─   ─────────────────────────────────   ─────────  ──────')

  for (let i = 0; i < tenantIds.length; i++) {
    const tid = tenantIds[i]
    const role = roles.find((r: any) => r.tenantId === tid)?.role || 'member'
    const isActive = tid === creds.tenantId
    let name = isActive ? (creds.tenantName || tid) : tid
    if (name === tid) {
      name = await resolveTenantName(API_URL, token, tid)
    }
    const status = isActive ? '✓ activo' : ''
    console.log(`  ${i + 1}   ${name.padEnd(37)} ${role.padEnd(10)} ${status}`)
  }

  console.log(`\nPara cambiar de tenant: npx @botuyo/mcp switch-tenant\n`)
}
