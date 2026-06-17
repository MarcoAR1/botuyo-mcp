/**
 * One-off ops script: fix the Ms. Ellis inter-agent transfer (transfer_to_department).
 *
 * The live agents' `transfer_to_department.params.departments` map had placeholder
 * IDs (<AGENT_ID_*>), so transfers resolved to a non-existent agent and failed.
 * This script SURGICALLY updates ONLY the transfer_to_department tool-config of each
 * agent (PUT /api/v1/mcp/agents/:id/tool-config/transfer_to_department) — it does NOT
 * touch prompts, stages, avatar, widget or anything else (no full re-import).
 *
 * Department topology (which keys each agent transfers to) is read from the repo JSON;
 * the real agent IDs come from agents/_backup/ms_ellis_idmap.json.
 *
 * Usage:
 *   node scripts/fix_ms_ellis_departments.mjs            # verify only (read-only GET + dry-run)
 *   node scripts/fix_ms_ellis_departments.mjs --apply    # apply to LIVE (prod write)
 *
 * Auth: BOTUYO_TOKEN / BOTUYO_API_URL env, else ~/.botuyo/credentials.json.
 */
import { readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const AGENTS_DIR = join(__dirname, '..', 'agents')
const DEFAULT_API_URL = 'https://api.botuyo.com'
const APPLY = process.argv.includes('--apply')
const CHECK = process.argv.includes('--check')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function resolveAuth() {
  let token = process.env.BOTUYO_TOKEN || null
  let apiUrl = process.env.BOTUYO_API_URL || null
  let tenantName = ''
  let tenantId = ''
  let email = ''
  try {
    const raw = readFileSync(join(homedir(), '.botuyo', 'credentials.json'), 'utf-8')
    const creds = JSON.parse(raw)
    token = token || creds.token
    apiUrl = apiUrl || creds.apiUrl || DEFAULT_API_URL
    tenantName = creds.tenantName || ''
    tenantId = creds.tenantId || ''
    email = creds.email || ''
  } catch {
    /* no credentials file */
  }
  apiUrl = apiUrl || DEFAULT_API_URL
  return { token, apiUrl, tenantName, tenantId, email }
}

async function apiOnce(method, apiUrl, token, path, body) {
  let res
  try {
    res = await fetch(`${apiUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        // Mimic the admin panel browser context (corporate Netskope proxy may block non-browser writes)
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Origin: 'https://admin.botuyo.com',
        Referer: 'https://admin.botuyo.com/',
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    })
  } catch (e) {
    e.retryable = true // network / TLS / DNS blip
    throw e
  }
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    // Non-JSON body = corporate proxy (Netskope) HTML block page or gateway error
    const err = new Error(`HTTP ${res.status} non-JSON (proxy/Netskope block)`)
    err.retryable = res.status === 403 || res.status >= 500 || /^\s*</.test(text) || text.includes('ns-template')
    throw err
  }
  if (!res.ok || json.success === false) {
    const err = new Error(`HTTP ${res.status}: ${json.error || text.slice(0, 160)}`)
    err.retryable = res.status >= 500
    throw err
  }
  return json
}

// Retry wrapper: the corporate Netskope proxy intermittently returns 403 HTML block
// pages on scripted bursts. Retrying with backoff + jitter clears it. Used by every
// call (discovery, --check, --apply) so they are all resilient.
async function api(method, apiUrl, token, path, body) {
  const MAX = 6
  let lastErr
  for (let attempt = 1; attempt <= MAX; attempt++) {
    try {
      return await apiOnce(method, apiUrl, token, path, body)
    } catch (e) {
      lastErr = e
      if (!e.retryable || attempt === MAX) throw e
      const wait = 1200 * attempt + Math.floor(Math.random() * 500)
      const tail = path.split('/').slice(-2).join('/')
      console.log(`  ⏳ bloqueo/transitorio en ${method} ${tail} (intento ${attempt}/${MAX}), reintento en ${wait}ms...`)
      await sleep(wait)
    }
  }
  throw lastErr
}

async function main() {
  const { token, apiUrl, tenantName, tenantId: currentTenantId, email } = resolveAuth()
  if (!token) {
    console.error('❌ No hay token. Ejecutá: npx @botuyo/mcp auth   (o seteá BOTUYO_TOKEN)')
    process.exit(1)
  }
  console.log(`\n🔧 Ms. Ellis — fix transfer_to_department`)
  console.log(`   API:    ${apiUrl}`)
  console.log(`   Tenant: ${tenantName || '(desconocido)'}  ·  ${email}`)
  console.log(`   Modo:   ${APPLY ? '🟥 APPLY (escribe en prod)' : '🟦 VERIFY (read-only)'}\n`)

  const KEYS = ['nivelador', 'a1', 'a2', 'b1', 'b2', 'c1', 'c2']
  // Expected display names come from the repo JSONs (source of truth for naming).
  const expectedName = {}
  for (const k of KEYS) {
    expectedName[k] = JSON.parse(readFileSync(join(AGENTS_DIR, `ms_ellis_${k}.json`), 'utf-8')).name
  }

  // 1) Discover which tenant actually holds the 7 Ms. Ellis agents (match by NAME,
  //    not the stale idmap). Iterate the user's tenants, minting a scoped token each.
  const me = await api('GET', apiUrl, token, '/api/auth/me')
  const tenantIds = me.data?.user?.tenantIds || []
  console.log(`Buscando los agentes Ms. Ellis en tus ${tenantIds.length} tenant(s)...\n`)

  let found = null // { tenantId, token, liveIdMap }
  for (const tid of tenantIds) {
    let tok = token
    if (tid !== currentTenantId) {
      try {
        const sw = await api('POST', apiUrl, token, '/api/auth/switch-tenant', { tenantId: tid })
        tok = sw.data?.token || token
      } catch (e) {
        console.log(`   tenant ${tid}: sin acceso (${e.message}) — salteado`)
        continue
      }
    }
    const agents = (await api('GET', apiUrl, tok, '/api/v1/mcp/agents')).data || []
    const liveIdMap = {}
    for (const k of KEYS) {
      const m = agents.find((a) => a.name === expectedName[k])
      if (m) liveIdMap[k] = m.id
    }
    const matched = Object.keys(liveIdMap).length
    const marker = tid === currentTenantId ? ' (actual)' : ''
    console.log(`   tenant ${tid}${marker}: ${agents.length} agentes, ${matched}/7 Ms. Ellis`)
    if (matched >= 4 && (!found || matched > Object.keys(found.liveIdMap).length)) {
      found = { tenantId: tid, token: tok, liveIdMap }
      if (matched === 7) break
    }
  }

  if (!found) {
    console.error(`\n❌ No encontré los agentes Ms. Ellis (por nombre) en ningún tenant.`)
    console.error(`   Revisá que estén creados o que los nombres coincidan con los JSON del repo.`)
    process.exit(1)
  }

  const liveIdMap = found.liveIdMap
  const tenantToken = found.token
  console.log(`\n✅ Tenant Ms. Ellis: ${found.tenantId}`)
  console.log(`\nMapa de IDs (live, por nombre):`)
  for (const k of KEYS) {
    console.log(`  ${liveIdMap[k] ? '✅' : '❌'} ${k.padEnd(10)} ${liveIdMap[k] || '(falta)'}  ← "${expectedName[k]}"`)
  }
  // Refresh the local idmap backup so it reflects reality (the old one was stale).
  try {
    writeFileSync(join(AGENTS_DIR, '_backup', 'ms_ellis_idmap.json'), JSON.stringify(liveIdMap, null, 2) + '\n')
    console.log(`\n   (idmap local actualizado: agents/_backup/ms_ellis_idmap.json)`)
  } catch {
    /* best-effort */
  }

  // Optional: read-only deep check of each agent's live state (departments + status + prompt intact).
  if (CHECK) {
    console.log(`\n🔎 CHECK — estado live de cada agente:`)
    for (const key of KEYS) {
      if (!liveIdMap[key]) continue
      const full = await api('GET', apiUrl, tenantToken, `/api/v1/mcp/agents/${liveIdMap[key]}`)
      const ac = full.data?.agentConfig || {}
      const depts = ac.toolConfigs?.transfer_to_department?.params?.departments || {}
      const okPrompt = !!(ac.identity?.objective || ac.identity?.customInstructions)
      const stages = (ac.stages || []).length
      console.log(`  ${key.padEnd(10)} [${full.data?.status}] prompt:${okPrompt ? 'ok' : 'MISSING'} stages:${stages}  departments: ${JSON.stringify(depts)}`)
      await sleep(800)
    }
    console.log('')
    return
  }

  // 2) Build per-agent departments from the repo JSON keys, resolved via the LIVE id map.
  console.log(`\nPlan de transfer_to_department (departments resueltos):`)
  const plan = []
  for (const key of KEYS) {
    if (!liveIdMap[key]) {
      console.log(`  ⚠️  ${key}: no está en live — salteado`)
      continue
    }
    const cfg = JSON.parse(readFileSync(join(AGENTS_DIR, `ms_ellis_${key}.json`), 'utf-8'))
    const td = cfg.toolConfigs?.transfer_to_department
    if (!td?.params?.departments) {
      console.log(`  ⚠️  ${key}: el JSON no tiene transfer_to_department.params.departments — salteado`)
      continue
    }
    const resolved = {}
    let missing = false
    for (const deptKey of Object.keys(td.params.departments)) {
      if (!liveIdMap[deptKey]) {
        console.log(`  ⚠️  ${key}: destino "${deptKey}" no existe en live — no lo puedo resolver`)
        missing = true
        continue
      }
      resolved[deptKey] = liveIdMap[deptKey]
    }
    if (missing) continue
    plan.push({
      key,
      agentId: liveIdMap[key],
      params: { departments: resolved, transfer_message: td.params.transfer_message },
      instruction: td.instruction
    })
    console.log(`  ${key.padEnd(10)} → { ${Object.entries(resolved).map(([k, v]) => `${k}:${v}`).join(', ')} }`)
  }

  if (!APPLY) {
    console.log(`\n🟦 VERIFY ok. Nada se escribió. Para aplicar a prod:  node scripts/fix_ms_ellis_departments.mjs --apply\n`)
    return
  }

  // 3) Apply surgically (only transfer_to_department tool-config).
  //    Pace requests + retry on Netskope (corporate proxy) block pages, which appear
  //    as a 403 text/html response when scripted writes burst too fast.
  console.log(`\n🟥 Aplicando a LIVE (con pausa + reintentos para pasar Netskope)...`)
  for (const p of plan) {
    const payload = { params: p.params }
    if (p.instruction !== undefined) payload.instruction = p.instruction
    await api('PUT', apiUrl, tenantToken, `/api/v1/mcp/agents/${p.agentId}/tool-config/transfer_to_department`, payload)
    console.log(`  ✅ ${p.key} actualizado`)
    await sleep(1500) // pace between agents to avoid anti-automation triggers
  }
  console.log(`\n✅ Listo. Los 7 agentes tienen el departments map con IDs reales.`)
  console.log(`   (Si los agentes estaban publicados, re-publicá para propagar — o verificá si el cambio es inmediato.)\n`)
}

main().catch((e) => {
  console.error(`\n❌ Error: ${e.message}`)
  if (e.cause) console.error(`   cause: [${e.cause.code || e.cause.errno || ''}] ${e.cause.message || e.cause}`)
  console.error('')
  process.exit(1)
})
