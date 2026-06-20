/**
 * One-off ops script: migrate the 7 live Ms. Ellis agents into ONE AgentFamily
 * (base + variants), IN PLACE — reusing each agent's existing _id so its apiKey
 * and associated Knowledge Bases are preserved (the public english-teacher demo
 * keeps working with the same apiKey, no frontend change).
 *
 * WHY in-place works: the family create body's `variants[].agentId` is honored by
 * AgentFamilyMaterializer — it UPDATES that agent (name/agentConfig/familyId/
 * variantKey) instead of creating a new one. KBs are associated by agentId (not in
 * agentConfig), so they survive. switch_variant is auto-wired from handoffTargets.
 *
 * Strategy: base = {} ; each variant.overrides = that agent's FULL current config
 * (faithful preservation). The 7 live agents ALREADY share memoryNamespace
 * "ms_ellis", so we PRESERVE it as-is (memory continuity across variants). The
 * entry (nivelador) gets an extra instruction telling it to call switch_variant
 * once it determines the student's CEFR level.
 *
 * Uses the MCP namespace (/api/v1/mcp/agent-families) because its tenant resolution
 * (getCallerMeta) matches the scoped switch-tenant token, exactly like the working
 * fix_ms_ellis_departments.mjs.
 *
 * Usage:
 *   node scripts/migrate_ms_ellis_family.mjs            # --export: READ-ONLY backup + dry-run plan
 *   node scripts/migrate_ms_ellis_family.mjs --apply    # create + publish the family on LIVE (prod write)
 *   node scripts/migrate_ms_ellis_family.mjs --verify    # re-read the family + members (read-only)
 *
 * TLS (corporate Netskope): run with a system CA bundle, e.g.
 *   security find-certificate -a -p /Library/Keychains/System.keychain > /tmp/ca_bundle.pem
 *   security find-certificate -a -p /System/Library/Keychains/SystemRootCertificates.keychain >> /tmp/ca_bundle.pem
 *   NODE_EXTRA_CA_CERTS=/tmp/ca_bundle.pem node scripts/migrate_ms_ellis_family.mjs
 *
 * Auth: BOTUYO_TOKEN / BOTUYO_API_URL env, else ~/.botuyo/credentials.json.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const AGENTS_DIR = join(__dirname, '..', 'agents')
const BACKUP_DIR = '/tmp/ms_ellis_backup'
const DEFAULT_API_URL = 'https://api.botuyo.com'
const APPLY = process.argv.includes('--apply')
const VERIFY = process.argv.includes('--verify')
const LIST = process.argv.includes('--list-families')
const CONVERT = process.argv.includes('--convert-switch')
const AUDIT = process.argv.includes('--audit-identity')
// The known ms-ellis family id (family#2, created by the in-place migration). Override via env.
const FAMILY_ID = process.env.MS_ELLIS_FAMILY_ID || '6a344975524b9e2d93406f40'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── Family shape ────────────────────────────────────────────────────────────
const KEYS = ['nivelador', 'a1', 'a2', 'b1', 'b2', 'c1', 'c2']
const ENTRY_KEY = 'nivelador'
const FAMILY_NAME = 'Ms. Ellis'
const FAMILY_SLUG = 'ms-ellis'
// The apiKey the public english-teacher demo currently embeds. We must confirm it
// belongs to a member (ideally the entry/nivelador) so the demo keeps working.
const DEMO_API_KEY = 'agent_cd6263de95644349b7b525051ad728de'
const LABELS = {
  nivelador: 'Nivelador (Placement)',
  a1: 'A1 (Beginner)',
  a2: 'A2 (Elementary)',
  b1: 'B1 (Intermediate)',
  b2: 'B2 (Upper-Intermediate)',
  c1: 'C1 (Advanced)',
  c2: 'C2 (Proficiency)'
}
const SWITCH_INSTRUCTION = `

## Cambio automático de variante por nivel (usar switch_variant)
Cuando determines el nivel CEFR del alumno, llamá a la herramienta \`switch_variant\` con \`variant\` = la clave del nivel en minúscula (a1, a2, b1, b2, c1 o c2). En \`handover_context\` resumí el nivel detectado, el nombre/edad/intereses y el objetivo del alumno para que la variante destino continúe sin volver a preguntar. No anuncies el cambio técnico; seguí la conversación con naturalidad. Usá switch_variant SOLO para cambiar de nivel dentro de Ms. Ellis (para derivar a otro agente usá transfer_to_department).`

// ── Auth + resilient HTTP (mirrors fix_ms_ellis_departments.mjs) ─────────────
function resolveAuth() {
  let token = process.env.BOTUYO_TOKEN || null
  let apiUrl = process.env.BOTUYO_API_URL || null
  let tenantName = ''
  let tenantId = ''
  let email = ''
  try {
    const creds = JSON.parse(readFileSync(join(homedir(), '.botuyo', 'credentials.json'), 'utf-8'))
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
    e.retryable = true
    throw e
  }
  let text
  try {
    text = await res.text()
  } catch (e) {
    // Body truncated mid-stream (corporate proxy on LARGE responses). For writes that
    // returned 2xx, the server succeeded but we can't read the (big) reply — return a
    // synthetic success and verify separately via small per-agent GETs. For GETs we
    // need the data, so mark retryable.
    if (res.ok && method !== 'GET') return { success: true, data: null, _truncated: true }
    e.retryable = true
    throw e
  }
  let json
  try {
    json = JSON.parse(text)
  } catch {
    const err = new Error(`HTTP ${res.status} non-JSON (proxy/Netskope block)`)
    err.retryable = res.status === 403 || res.status >= 500 || /^\s*</.test(text) || text.includes('ns-template')
    throw err
  }
  if (!res.ok || json.success === false) {
    const err = new Error(`HTTP ${res.status}: ${json.error || text.slice(0, 200)}`)
    err.status = res.status
    err.retryable = res.status >= 500
    throw err
  }
  return json
}

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

// ── Helpers ──────────────────────────────────────────────────────────────────
/** Recursively drop null/undefined (the family/agent DTOs reject null fields). */
function stripNulls(value) {
  if (Array.isArray(value)) return value.map(stripNulls)
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      if (v === null || v === undefined) continue
      out[k] = stripNulls(v)
    }
    return out
  }
  return value
}

/** Compose the CreateAgentFamilyInput body from the live per-key exports. */
function composeFamily(exportsByKey) {
  const present = KEYS.filter((k) => exportsByKey[k]?.agentConfig)
  const variants = present.map((k, i) => {
    const cfg = stripNulls(structuredClone(exportsByKey[k].agentConfig))
    // Preserve the existing shared memoryNamespace ("ms_ellis") for memory continuity.
    if (k === ENTRY_KEY) {
      cfg.identity = cfg.identity || {}
      cfg.identity.customInstructions = (cfg.identity.customInstructions || '') + SWITCH_INSTRUCTION
    }
    return {
      key: k,
      label: LABELS[k] || k,
      agentId: exportsByKey[k].agentId, // in-place adoption: preserves apiKey + KBs
      overrides: cfg,
      handoffTargets: present.filter((o) => o !== k), // full mesh
      order: i
    }
  })
  return { name: FAMILY_NAME, slug: FAMILY_SLUG, entryVariantKey: ENTRY_KEY, base: {}, variants }
}

// ── switch_variant conversion (whole family) ─────────────────────────────────
// Promotion topology mirroring the ORIGINAL transfer_to_department dept-maps:
// the nivelador can route to any level; each level promotes to the next + can
// fall back to the nivelador. switch_variant.params.variants is auto-built by the
// materializer from these handoffTargets (no hardcoded ids).
const HANDOFF = {
  nivelador: ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'],
  a1: ['a2', 'nivelador'],
  a2: ['b1', 'nivelador'],
  b1: ['b2', 'nivelador'],
  b2: ['c1', 'nivelador'],
  c1: ['c2', 'nivelador'],
  c2: ['nivelador']
}
const STAGE_SKIP_FIELDS = new Set(['id', '_id', 'type'])

/** Rewrite routing prose: transfer_to_department(department) → switch_variant(variant). */
function rewriteRouting(text) {
  if (typeof text !== 'string') return text
  return text.replace(/transfer_to_department/g, 'switch_variant').replace(/\bdepartment\b/g, 'variant')
}

/** Drop the migration-appended "## Cambio automático de variante por nivel ..." block (appended last). */
function stripAppendedSwitchInstruction(text) {
  if (typeof text !== 'string') return text
  return text.replace(/\n*##\s*Cambio autom[aá]tico de variante por nivel[\s\S]*$/m, '').trimEnd()
}

/** Convert ONE agentConfig from the transfer_to_department model to the switch_variant model. */
function convertConfig(agentConfig) {
  const cfg = stripNulls(structuredClone(agentConfig))
  if (cfg.identity) {
    if (cfg.identity.objective) cfg.identity.objective = rewriteRouting(cfg.identity.objective)
    if (cfg.identity.customInstructions) {
      cfg.identity.customInstructions = rewriteRouting(stripAppendedSwitchInstruction(cfg.identity.customInstructions))
    }
  }
  if (Array.isArray(cfg.stages)) {
    cfg.stages = cfg.stages.map((s) => {
      const ns = { ...s }
      for (const f of Object.keys(ns)) {
        if (typeof ns[f] === 'string' && !STAGE_SKIP_FIELDS.has(f)) ns[f] = rewriteRouting(ns[f])
      }
      // Per-stage tool allow-list: swap transfer_to_department → switch_variant where present.
      if (Array.isArray(ns.tools)) {
        const had = ns.tools.includes('transfer_to_department')
        ns.tools = ns.tools.filter((t) => t !== 'transfer_to_department')
        if (had && !ns.tools.includes('switch_variant')) ns.tools = [...ns.tools, 'switch_variant']
      }
      return ns
    })
  }
  // Remove transfer_to_department (tool + config) — it's no longer the level-routing mechanism.
  if (Array.isArray(cfg.enabledTools)) cfg.enabledTools = cfg.enabledTools.filter((t) => t !== 'transfer_to_department')
  if (cfg.toolConfigs && cfg.toolConfigs.transfer_to_department) delete cfg.toolConfigs.transfer_to_department
  // Let the materializer re-wire switch_variant.params.variants from handoffTargets (drop stale params).
  if (cfg.toolConfigs && cfg.toolConfigs.switch_variant) delete cfg.toolConfigs.switch_variant
  if (Array.isArray(cfg.enabledTools) && !cfg.enabledTools.includes('switch_variant')) cfg.enabledTools.push('switch_variant')
  // Web demo fix: undo the per-TENANT AssistantWebIdentityMigration over-reach. That backfill set
  // requiresUserIdentity=true on EVERY agent in the assistant tenant (ASSISTANT_TENANT_ID), which is
  // the same tenant where Ms. Ellis lives — so the gateway rejected the web demo with
  // USER_IDENTITY_REQUIRED. These 7 agents ARE the anonymous-web demo (and switch_variant between
  // each other in-session), so none of them needs a per-user identity.
  cfg.requiresUserIdentity = false
  return cfg
}

/** Build the ImportAgentFamilyInput (full-replace) with converted variants. */
function buildConvertPayload(exportsByKey) {
  const present = KEYS.filter((k) => exportsByKey[k]?.agentConfig)
  const variants = present.map((k, i) => {
    const targets = (HANDOFF[k] || present.filter((o) => o !== k)).filter((t) => present.includes(t))
    return { key: k, label: LABELS[k] || k, overrides: convertConfig(exportsByKey[k].agentConfig), handoffTargets: targets, order: i }
  })
  return { name: FAMILY_NAME, slug: FAMILY_SLUG, entryVariantKey: ENTRY_KEY, base: {}, variants }
}

/** Discover the tenant holding the Ms. Ellis agents (match by NAME, idmap can be stale). */
async function discover(apiUrl, baseToken, currentTenantId) {
  const expectedName = {}
  for (const k of KEYS) {
    expectedName[k] = JSON.parse(readFileSync(join(AGENTS_DIR, `ms_ellis_${k}.json`), 'utf-8')).name
  }
  const me = await api('GET', apiUrl, baseToken, '/api/auth/me')
  const tenantIds = me.data?.user?.tenantIds || []
  console.log(`Buscando los agentes Ms. Ellis en tus ${tenantIds.length} tenant(s)...\n`)

  let found = null
  for (const tid of tenantIds) {
    let tok = baseToken
    if (tid !== currentTenantId) {
      try {
        const sw = await api('POST', apiUrl, baseToken, '/api/auth/switch-tenant', { tenantId: tid })
        tok = sw.data?.token || baseToken
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
    console.log(`   tenant ${tid}${tid === currentTenantId ? ' (actual)' : ''}: ${agents.length} agentes, ${matched}/7 Ms. Ellis`)
    if (matched >= 4 && (!found || matched > Object.keys(found.liveIdMap).length)) {
      found = { tenantId: tid, token: tok, liveIdMap }
      if (matched === 7) break
    }
    await sleep(400)
  }
  if (!found) throw new Error('No encontré los agentes Ms. Ellis (por nombre) en ningún tenant.')
  return found
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const { token, apiUrl, tenantName, tenantId: currentTenantId, email } = resolveAuth()
  if (!token) {
    console.error('❌ No hay token. Ejecutá: npx @botuyo/mcp auth   (o seteá BOTUYO_TOKEN)')
    process.exit(1)
  }
  const mode = APPLY ? '🟥 APPLY (escribe en prod)' : VERIFY ? '🟨 VERIFY (read-only)' : '🟦 EXPORT (read-only, dry-run)'
  console.log(`\n📚 Ms. Ellis → AgentFamily (migración in-place)`)
  console.log(`   API:    ${apiUrl}`)
  console.log(`   Cuenta: ${tenantName || '(?)'}  ·  ${email}`)
  console.log(`   Modo:   ${mode}\n`)

  const { tenantId, token: tk, liveIdMap } = await discover(apiUrl, token, currentTenantId)
  console.log(`\n✅ Tenant Ms. Ellis: ${tenantId}`)
  for (const k of KEYS) {
    console.log(`  ${liveIdMap[k] ? '✅' : '❌'} ${k.padEnd(10)} ${liveIdMap[k] || '(falta)'}`)
  }
  if (Object.keys(liveIdMap).length < KEYS.length) {
    console.log(`\n⚠️  Faltan variantes en live (${Object.keys(liveIdMap).length}/7). Reviso igual lo encontrado.`)
  }

  // ── AUDIT-IDENTITY: ensure ONLY the real assistant agent has requiresUserIdentity=true ──
  // The AssistantWebIdentityMigration blanket-set the flag on EVERY agent in this tenant. The user
  // wants it strictly on the assistant agent; every other agent (ms-ellis + anything else) = false.
  if (AUDIT) {
    console.log(`\n🔐 Auditoría requiresUserIdentity — tenant ${tenantId}`)
    const agents = (await api('GET', apiUrl, tk, '/api/v1/mcp/agents')).data || []
    console.log(`   ${agents.length} agente(s) en el tenant. Leyendo config de cada uno...\n`)
    const rows = []
    for (const a of agents) {
      const full = await api('GET', apiUrl, tk, `/api/v1/mcp/agents/${a.id}`)
      const d = full.data || {}
      const ac = d.agentConfig || {}
      const name = d.name || ac.name || '(sin nombre)'
      const isEllis = Object.values(liveIdMap).includes(a.id) || d.familyId === FAMILY_ID
      const isAssistant = !isEllis && /asist|assistant/i.test(name)
      rows.push({
        id: a.id,
        name,
        status: d.status,
        familyId: d.familyId || null,
        variantKey: d.variantKey || null,
        req: ac.requiresUserIdentity ?? false,
        isEllis,
        isAssistant
      })
      await sleep(600)
    }
    for (const r of rows) {
      const cls = r.isEllis ? 'ms-ellis' : r.isAssistant ? 'ASSISTANT' : 'otro'
      const verdict = r.isAssistant
        ? r.req
          ? 'mantener true ✅'
          : 'es assistant pero está false ⚠️'
        : r.req
          ? 'DEBE PASAR A false ⚠️'
          : 'ok ✅'
      console.log(
        `  [${cls.padEnd(9)}] ${String(r.name).slice(0, 34).padEnd(36)} req=${String(r.req).padEnd(5)} ` +
          `${r.familyId ? 'family ' : 'standalone'.padEnd(7)} ${verdict}   ${r.id}`
      )
    }
    const toFix = rows.filter((r) => !r.isAssistant && r.req)
    const standaloneToFix = toFix.filter((r) => !r.familyId)
    const familyToFix = toFix.filter((r) => r.familyId)
    console.log(`\n  → ${toFix.length} agente(s) no-assistant con requiresUserIdentity=true.`)
    if (familyToFix.length) {
      console.log(
        `     ⚠️ ${familyToFix.length} pertenece(n) a una family — se corrigen republicando esa family (un patch directo lo revierte el próximo publish): ` +
          familyToFix.map((r) => `${r.name}[${r.familyId}]`).join(', ')
      )
    }
    if (!APPLY) {
      console.log(`\n🟦 DRY-RUN. Nada se escribió. Corré con --audit-identity --apply para poner false en los standalone no-assistant.`)
      return
    }
    for (const r of standaloneToFix) {
      console.log(`  🟥 PUT requiresUserIdentity=false → ${r.name} (${r.id})`)
      await api('PUT', apiUrl, tk, `/api/v1/mcp/agents/${r.id}`, { requiresUserIdentity: false })
      await sleep(800)
    }
    console.log(`\n🔎 Re-verificando...`)
    for (const r of rows) {
      const full = await api('GET', apiUrl, tk, `/api/v1/mcp/agents/${r.id}`)
      const req = full.data?.agentConfig?.requiresUserIdentity ?? false
      const cls = r.isEllis ? 'ms-ellis' : r.isAssistant ? 'ASSISTANT' : 'otro'
      console.log(`  [${cls.padEnd(9)}] ${String(r.name).slice(0, 34).padEnd(36)} req=${req}`)
      await sleep(600)
    }
    console.log(`\n✅ Auditoría aplicada. Solo el assistant debería quedar en true.`)
    return
  }

  // ── LIST: enumerate families (read-only) to find ms-ellis + detect duplicates ──
  if (LIST) {
    console.log(`\n📋 Listando families del tenant (puede truncar por proxy; reintenta)...`)
    const res = await api('GET', apiUrl, tk, '/api/v1/mcp/agent-families')
    const fams = res.data || []
    console.log(`  Total families: ${fams.length}`)
    for (const f of fams) {
      const keys = (f.variants || []).map((v) => v.key).join(',')
      console.log(`  - ${f._id}  slug=${f.slug}  name="${f.name}"  status=${f.status}  entry=${f.entryVariantKey}  variants=[${keys}]`)
    }
    const ellis = fams.filter((f) => f.slug === FAMILY_SLUG || f.name === FAMILY_NAME)
    console.log(`\n  ms-ellis families: ${ellis.length} → ${ellis.map((f) => f._id).join(', ') || '(none)'}`)
    if (ellis.length > 1) {
      console.log(`  ⚠️ DUPLICADO: ${ellis.length} families ms-ellis. La huérfana se borra por DB (NO por la API: deleteFamily soft-borra los agentes compartidos).`)
    }
    return
  }

  // ── CONVERT: rewrite routing transfer_to_department → switch_variant (whole family) ──
  if (CONVERT) {
    console.log(`\n🔁 Conversión a switch_variant — familyId=${FAMILY_ID}`)
    const exportsByKey = {}
    console.log(`   Re-exportando configs vivas...`)
    for (const k of KEYS) {
      if (!liveIdMap[k]) continue
      const full = await api('GET', apiUrl, tk, `/api/v1/mcp/agents/${liveIdMap[k]}`)
      exportsByKey[k] = { agentId: liveIdMap[k], agentConfig: full.data?.agentConfig || {} }
      await sleep(600)
    }
    const payload = buildConvertPayload(exportsByKey)
    mkdirSync(BACKUP_DIR, { recursive: true })
    writeFileSync(join(BACKUP_DIR, '_convert_payload.json'), JSON.stringify(payload, null, 2) + '\n')
    console.log(`\n── Plan de conversión (guardado en ${BACKUP_DIR}/_convert_payload.json) ──`)
    for (const v of payload.variants) {
      const tools = v.overrides.enabledTools || []
      const transferLeft = tools.includes('transfer_to_department') || JSON.stringify(v.overrides).includes('transfer_to_department')
      const reqId = v.overrides.requiresUserIdentity
      console.log(
        `  ${v.key.padEnd(10)} handoff=[${v.handoffTargets.join(',')}] tools=[${tools.join(',')}] ` +
          `transfer_left=${transferLeft ? 'YES⚠️' : 'no✅'} requiresUserIdentity=${reqId === false ? 'false✅' : String(reqId) + '⚠️'}`
      )
    }

    if (!APPLY) {
      console.log(`\n🟦 DRY-RUN. Nada se escribió. Revisá ${BACKUP_DIR}/_convert_payload.json y corré con --convert-switch --apply.`)
      return
    }

    console.log(`\n🟥 Import (full-replace, in-place) en family ${FAMILY_ID}...`)
    await api('PUT', apiUrl, tk, `/api/v1/mcp/agent-families/${FAMILY_ID}/import`, payload)
    console.log(`  ✅ Import enviado.`)
    await sleep(1500)
    console.log(`\n🚀 Publicando la family...`)
    await api('PUT', apiUrl, tk, `/api/v1/mcp/agent-families/${FAMILY_ID}/publish`)
    console.log(`  ✅ Publish enviado.`)
    await sleep(1500)

    console.log(`\n🔎 Verificando (switch_variant presente, transfer_to_department ausente)...`)
    for (const k of KEYS) {
      if (!liveIdMap[k]) continue
      const full = await api('GET', apiUrl, tk, `/api/v1/mcp/agents/${liveIdMap[k]}`)
      const ac = full.data?.agentConfig || {}
      const sv = ac.toolConfigs?.switch_variant?.params?.variants || {}
      const tools = ac.enabledTools || []
      const reqId = ac.requiresUserIdentity ?? false
      console.log(
        `  ${k.padEnd(10)} [${full.data?.status}] switch_variant→{${Object.keys(sv).join(',')}} ` +
          `transfer_to_department=${tools.includes('transfer_to_department') ? 'STILL PRESENT⚠️' : 'removed✅'} ` +
          `webIdentity=${reqId ? 'REQUIRED⚠️' : 'anon-ok✅'}`
      )
      await sleep(700)
    }
    console.log(`\n✅ Conversión aplicada. Ms. Ellis ahora deriva entre niveles con switch_variant.`)
    return
  }

  // ── VERIFY: read each member agent (small GETs) and report family wiring ──
  // Avoids the huge /agent-families payload (which the proxy truncates).
  if (VERIFY) {
    console.log(`\n🔎 Estado de los miembros:`)
    for (const k of KEYS) {
      if (!liveIdMap[k]) continue
      const full = await api('GET', apiUrl, tk, `/api/v1/mcp/agents/${liveIdMap[k]}`)
      const d = full.data || {}
      const ac = d.agentConfig || {}
      const sv = ac.toolConfigs?.switch_variant?.params?.variants || {}
      console.log(
        `  ${k.padEnd(10)} [${d.status}] familyId=${d.familyId || '(none)'} variantKey=${d.variantKey || '(none)'} ` +
          `mem=${ac.memoryNamespace || '(?)'} switch_variant→{${Object.keys(sv).join(',')}}`
      )
      await sleep(700)
    }
    return
  }

  // ── Export every member's full live config (backup) ──
  mkdirSync(BACKUP_DIR, { recursive: true })
  const exportsByKey = {}
  const summary = []
  console.log(`\n📦 Exportando configs vivas a ${BACKUP_DIR} ...`)
  for (const k of KEYS) {
    if (!liveIdMap[k]) continue
    const full = await api('GET', apiUrl, tk, `/api/v1/mcp/agents/${liveIdMap[k]}`)
    const data = full.data || {}
    const ac = data.agentConfig || {}
    exportsByKey[k] = { agentId: liveIdMap[k], apiKey: data.apiKey, agentConfig: ac }
    writeFileSync(join(BACKUP_DIR, `${k}.json`), JSON.stringify(data, null, 2) + '\n')
    summary.push({
      key: k,
      agentId: liveIdMap[k],
      apiKey: data.apiKey || '(no expuesto)',
      status: data.status,
      name: data.name || ac.name,
      memoryNamespace: ac.memoryNamespace || '(none)',
      hasPrompt: !!(ac.identity?.objective || ac.identity?.customInstructions),
      stages: (ac.stages || []).length,
      enabledTools: (ac.enabledTools || []).length,
      hasSwitchVariant: (ac.enabledTools || []).includes('switch_variant'),
      isDemoEntry: data.apiKey === DEMO_API_KEY
    })
    await sleep(700)
  }
  writeFileSync(join(BACKUP_DIR, '_summary.json'), JSON.stringify(summary, null, 2) + '\n')

  console.log(`\n── Resumen de los agentes vivos ──`)
  for (const s of summary) {
    console.log(
      `  ${s.key.padEnd(10)} [${s.status}] prompt:${s.hasPrompt ? 'ok' : 'MISSING'} stages:${s.stages} ` +
        `tools:${s.enabledTools} mem:${s.memoryNamespace} ${s.isDemoEntry ? '⭐ DEMO ENTRY' : ''}`
    )
    console.log(`             apiKey: ${s.apiKey}`)
  }
  const demoMatch = summary.find((s) => s.isDemoEntry)
  console.log(
    demoMatch
      ? `\n⭐ El apiKey del demo (${DEMO_API_KEY}) es la variante "${demoMatch.key}". ` +
          `entryVariantKey="${ENTRY_KEY}" ${demoMatch.key === ENTRY_KEY ? '✅ coincide' : `⚠️ NO coincide (es ${demoMatch.key})`}.`
      : `\n⚠️ El apiKey del demo (${DEMO_API_KEY}) NO coincide con ninguno de los 7 (¿apiKey no expuesto por la API, o el demo usa otro agente?). ` +
          `Hay que confirmarlo antes de tocar el front.`
  )

  // ── Compose + persist the proposed family payload (NOT sent unless --apply) ──
  const payload = composeFamily(exportsByKey)
  writeFileSync(join(BACKUP_DIR, '_family_payload.json'), JSON.stringify(payload, null, 2) + '\n')
  console.log(
    `\n🧬 Payload de family compuesto (base={}, ${payload.variants.length} variantes, entry="${payload.entryVariantKey}", ` +
      `handoff full-mesh, switch_variant en nivelador). Guardado en ${BACKUP_DIR}/_family_payload.json`
  )

  if (!APPLY) {
    console.log(`\n🟦 DRY-RUN ok. Nada se escribió. Revisá los backups y luego corré con --apply.`)
    console.log(`   Prerequisito: el tenant ${tenantId} necesita maxVariantsPerFamily >= ${payload.variants.length} (default=1 → 403).`)
    return
  }

  // ── APPLY: create (idempotent) + publish on LIVE, resilient to proxy truncation ──
  const niveladorId = liveIdMap[ENTRY_KEY]
  if (!niveladorId) throw new Error(`No encontré el agente entry "${ENTRY_KEY}" en live.`)

  // Idempotency: if the nivelador already has a familyId, the migration already ran
  // (e.g. a prior --apply whose large response was truncated). Reuse it; never duplicate.
  const nivNow = await api('GET', apiUrl, tk, `/api/v1/mcp/agents/${niveladorId}`)
  let familyId = nivNow.data?.familyId || null

  if (familyId) {
    console.log(`\nℹ️  El nivelador ya pertenece a la family ${familyId} — la reuso (no recreo).`)
  } else {
    console.log(`\n🟥 Creando la family en LIVE (POST /api/v1/mcp/agent-families)...`)
    let created
    try {
      created = await api('POST', apiUrl, tk, '/api/v1/mcp/agent-families', payload)
    } catch (e) {
      if (e.status === 403) {
        console.error(
          `\n❌ 403 límite de plan: el tenant ${tenantId} tiene maxVariantsPerFamily < ${payload.variants.length}.\n` +
            `   Subilo desde el admin panel (tenant → "Variantes / familia" = ${payload.variants.length} o -1) y reintentá --apply.`
        )
        process.exit(2)
      }
      throw e
    }
    familyId = created.data?._id || null
    if (!familyId) {
      // Response body was truncated by the proxy; the server likely still created it.
      // Recover the familyId from the now-adopted nivelador.
      console.log(`  ⚠️ Respuesta truncada por el proxy; verifico si el create igual prosperó...`)
      await sleep(2000)
      const recheck = await api('GET', apiUrl, tk, `/api/v1/mcp/agents/${niveladorId}`)
      familyId = recheck.data?.familyId || null
    }
    if (!familyId) {
      throw new Error('No pude confirmar el familyId tras el create. Corré --verify para inspeccionar antes de reintentar.')
    }
    console.log(`  ✅ Family creada/adoptada: ${familyId}`)
  }
  await sleep(1500)

  console.log(`\n🚀 Publicando la family...`)
  await api('PUT', apiUrl, tk, `/api/v1/mcp/agent-families/${familyId}/publish`)
  console.log(`  ✅ Publish enviado.`)
  await sleep(1500)

  console.log(`\n🔎 Verificando miembros (switch_variant + familyId, vía GETs por agente)...`)
  for (const k of KEYS) {
    if (!liveIdMap[k]) continue
    const full = await api('GET', apiUrl, tk, `/api/v1/mcp/agents/${liveIdMap[k]}`)
    const d = full.data || {}
    const ac = d.agentConfig || {}
    const sv = ac.toolConfigs?.switch_variant?.params?.variants || {}
    console.log(
      `  ${k.padEnd(10)} [${d.status}] familyId=${d.familyId ? 'ok' : 'MISSING'} variantKey=${d.variantKey || '(none)'} ` +
        `switch_variant→{${Object.keys(sv).join(',')}}`
    )
    await sleep(700)
  }
  console.log(`\n✅ Migración aplicada. Family "${FAMILY_NAME}" (${familyId}).`)
  console.log(`   El demo apunta al apiKey de la entry (${ENTRY_KEY}); ahora puede switch_variant a los niveles.`)
}

main().catch((e) => {
  console.error(`\n❌ Error: ${e.message}`)
  if (e.cause) console.error(`   cause: [${e.cause.code || e.cause.errno || ''}] ${e.cause.message || e.cause}`)
  console.error('')
  process.exit(1)
})
