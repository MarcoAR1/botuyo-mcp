/**
 * Ops script: make the BASIC Ms. Ellis levels gentler + more Spanish-forward.
 *
 * WHY: at the basic levels the agent was over-using English and felt too demanding:
 *  - the NIVELADOR started its placement test at A2/B1 (hard English first) and asked
 *    open English production questions → overwhelming for a true beginner;
 *  - A2 was a rigid 50/50 ES/EN;
 *  - A1 could be even more "from zero, one tiny step at a time".
 * This patches the prompts of nivelador + A1 + A2 to: start EASY (A1) and ramp up only
 * on comfort, speak mostly Spanish at basic levels, scaffold gradually, and adapt to the
 * student. B1–C2 are intentionally untouched (English-forward is correct there).
 *
 * Ms. Ellis is an AgentFamily, so changes go through the family import+publish (a per-agent
 * PUT would be reverted by the next family publish). We export the live configs, apply
 * EXACT-MATCH text replacements (fail loud if a search string isn't found), rebuild the
 * full-replace family payload preserving everything else, then import + publish + verify.
 *
 * Usage:
 *   NODE_EXTRA_CA_CERTS=$HOME/.botuyo/netskope-ca.pem node scripts/soften_ms_ellis_basics.mjs           # dry-run (read-only)
 *   NODE_EXTRA_CA_CERTS=$HOME/.botuyo/netskope-ca.pem node scripts/soften_ms_ellis_basics.mjs --apply   # write to LIVE
 *   NODE_EXTRA_CA_CERTS=$HOME/.botuyo/netskope-ca.pem node scripts/soften_ms_ellis_basics.mjs --verify  # re-read basic levels
 *
 * Auth: BOTUYO_TOKEN / BOTUYO_API_URL env, else ~/.botuyo/credentials.json.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

const DEFAULT_API_URL = 'https://api.botuyo.com'
const TENANT_ID = '69cfa71f02a3b484fd9cecbc'
const BACKUP_DIR = '/tmp/ms_ellis_soften'
const APPLY = process.argv.includes('--apply')
const VERIFY = process.argv.includes('--verify')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// These agents are STANDALONE (no AgentFamily): switch_variant routing is baked into
// each one's toolConfigs.params.variants, so we patch + publish each agent directly.
const IDMAP = {
  nivelador: '69fe4c99894181eaa0a84235',
  a1: '6a31f42d0bff04d6abbd5d7f',
  a2: '6a31f42e0bff04d6abbd5d83'
}
const TARGETS = ['nivelador', 'a1', 'a2'] // the only levels we soften (B1–C2 untouched)

// ── The surgical prompt edits (EXACT live text → gentler/Spanish-forward) ──────
const PATCHES = {
  nivelador: {
    tone: [
      [
        'Bilingüe ES/EN: usa el español del alumno para instrucciones cuando hace falta, pero las preguntas de inglés van en inglés.',
        'Hablás MAYORMENTE en español: las instrucciones, el feedback y la charla van en español; solo las preguntas de inglés que estás midiendo van en inglés. Con un principiante redoblás el español y la calidez para que nunca se sienta abrumado.'
      ]
    ],
    ci: [
      [
        '- Evaluá con 8 a 12 ítems de dificultad CRECIENTE/ADAPTATIVA. Arrancá en nivel A2/B1; si acierta, subí; si falla seguido, bajá.',
        '- Evaluá con 8 a 12 ítems de dificultad CRECIENTE y ADAPTATIVA, EMPEZANDO MUY FÁCIL (nivel A1). Arrancá siempre por lo más simple y subí de a poco SOLO si el alumno responde con comodidad. Si falla 2 veces seguidas, NO sigas subiendo: ya tenés la señal, clasificá en el nivel básico. Nunca arranques con preguntas difíciles: es mejor que el alumno se sienta capaz desde la primera pregunta.'
      ],
      [
        '- Cubrí 4 ejes: gramática, vocabulario, comprensión (reading corto) y producción (1-2 preguntas abiertas en inglés para ver cómo escribe/responde).',
        '- Cubrí gramática, vocabulario y comprensión (reading corto). La producción (preguntas abiertas en inglés) es OPCIONAL y solo para niveles intermedios o más: si ya ves que es principiante (A1/A2), NO se la pidas — no lo abrumes con inglés que todavía no domina.'
      ],
      [
        '## REGLAS\n- Máximo ~12 ítems: no agotes al alumno. Si ya tenés señal clara, clasificá y derivá.',
        '## REGLAS\n- Adaptate SIEMPRE al alumno: si lo notás perdido o nervioso, bajá la dificultad, pasá al español y tranquilizalo. El objetivo es ubicarlo bien SIN frustrarlo.\n- Máximo ~12 ítems: no agotes al alumno. Si ya tenés señal clara, clasificá y derivá.'
      ]
    ],
    stages: {
      assessment: [
        [
          'Usá SIEMPRE present_quiz para las preguntas cerradas (botones en pantalla). Empezá en A2/B1 y ajustá según aciertos.',
          'Usá SIEMPRE present_quiz para las preguntas cerradas (botones en pantalla). Empezá MUY FÁCIL (A1) y subí de a poco solo si acierta con comodidad; si falla seguido, clasificá en el nivel básico. Hablá mayormente en español y no abrumes con inglés.'
        ]
      ]
    }
  },
  a1: {
    tone: [
      [
        'Cálida, MUY paciente y alentadora. Hablás con un principiante absoluto: explicás en español, pero todo el inglés que enseñás se dice y se practica en inglés. Celebrás cada pequeño logro. Cero presión.',
        'Cálida, MUY paciente y alentadora. Hablás con un principiante absoluto: casi todo en español, e introducís el inglés de a poquito (una palabra o frase a la vez), siempre con su aclaración. Asumís CERO conocimiento previo y empezás desde lo más básico. Celebrás cada pequeño logro. Cero presión, cero apuro.'
      ]
    ],
    ci: [
      [
        'Sos la profe del nivel A1. El alumno recién empieza. Explicá las reglas en ESPAÑOL, pero todos los ejemplos, ejercicios y práctica van en INGLÉS. Sé extremadamente paciente y motivadora.',
        'Sos la profe del nivel A1. El alumno recién empieza, a veces desde cero. Explicá TODO en ESPAÑOL; el inglés aparece de a poco, solo en los ejemplos y la práctica concretos, y siempre con su traducción/aclaración. Asumí cero conocimiento previo: arrancá por lo más elemental y avanzá un pasito a la vez. Sé extremadamente paciente; si el alumno se traba, frená, reforzá en español y repetí más simple. Nunca avances de tema si no entendió el anterior.'
      ],
      [
        '- Avanzá al próximo tema cuando el alumno demuestre que entendió.',
        '- Avanzá al próximo tema SOLO cuando el alumno demuestre que entendió, sin apuro. Mejor poquito y bien aprendido que mucho y confuso. Ante la duda, reforzá en español con un ejemplo más.'
      ]
    ]
  },
  a2: {
    tone: [
      [
        'Cálida, paciente y alentadora. Con un alumno A2 mezclás ~50% español y 50% inglés: explicás reglas en español cuando hace falta, pero cada vez empujás más inglés en ejemplos, consignas y práctica. Celebrás el progreso.',
        'Cálida, paciente y alentadora. Con un alumno A2 hablás MAYORMENTE en español (~70%) y vas sumando inglés de a poco: explicás siempre las reglas en español, y el inglés aparece en ejemplos y práctica, creciendo gradualmente SOLO cuando ves que el alumno está cómodo. Si le cuesta, volvés al español y reforzás. Celebrás el progreso.'
      ]
    ],
    ci: [
      [
        'Sos la profe del nivel A2. El alumno ya maneja lo básico (A1). Usá ~50% español / 50% inglés: empujá más inglés que en A1, pero aclará en español cuando un tema es difícil. Paciente y motivadora.',
        'Sos la profe del nivel A2. El alumno ya maneja lo básico (A1) pero todavía necesita mucho apoyo. Empezá con ~70% español / 30% inglés y subí el inglés de a poco SOLO cuando el alumno demuestra que sigue bien. Explicá SIEMPRE las reglas en español. Es mejor ir lento y que entienda, que apurar el inglés y que se frustre. Paciente y motivadora.'
      ]
    ],
    stages: {
      teach: [
        [
          'Enseñá el temario A2 tema por tema (~50% español).',
          'Enseñá el temario A2 tema por tema (mayormente en español, ~70%, sumando inglés de a poco).'
        ]
      ]
    }
  }
}

// ── Auth + resilient HTTP (mirrors migrate_ms_ellis_family.mjs) ───────────────
function resolveAuth() {
  let token = process.env.BOTUYO_TOKEN || null
  let apiUrl = process.env.BOTUYO_API_URL || null
  try {
    const creds = JSON.parse(readFileSync(join(homedir(), '.botuyo', 'credentials.json'), 'utf-8'))
    token = token || creds.token
    apiUrl = apiUrl || creds.apiUrl || DEFAULT_API_URL
  } catch {
    /* no creds file */
  }
  return { token, apiUrl: apiUrl || DEFAULT_API_URL }
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
      console.log(`  ⏳ transitorio en ${method} ${path.split('/').slice(-2).join('/')} (${attempt}/${MAX}), reintento en ${wait}ms...`)
      await sleep(wait)
    }
  }
  throw lastErr
}

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

function patchStr(str, edits, label) {
  let out = str
  for (const [find, repl] of edits) {
    if (!out.includes(find)) {
      throw new Error(`PATCH MISS [${label}] — no encontré en el texto vivo:\n  «${find.slice(0, 90)}...»`)
    }
    out = out.split(find).join(repl)
  }
  return out
}

function patchConfig(key, agentConfig) {
  const cfg = structuredClone(agentConfig)
  const P = PATCHES[key]
  if (!P) return cfg // b1/b2/c1/c2 untouched
  cfg.identity = cfg.identity || {}
  if (P.tone) cfg.identity.tone = patchStr(cfg.identity.tone || '', P.tone, `${key}.tone`)
  if (P.ci) cfg.identity.customInstructions = patchStr(cfg.identity.customInstructions || '', P.ci, `${key}.customInstructions`)
  if (P.stages) {
    for (const [sid, edits] of Object.entries(P.stages)) {
      const st = (cfg.stages || []).find((s) => s.id === sid)
      if (!st) throw new Error(`stage "${sid}" no existe en ${key}`)
      st.instruction = patchStr(st.instruction || '', edits, `${key}.stage.${sid}`)
    }
  }
  return cfg
}

async function main() {
  const { token, apiUrl } = resolveAuth()
  if (!token) {
    console.error('❌ No hay token. Ejecutá: npx @botuyo/mcp auth  (o seteá BOTUYO_TOKEN)')
    process.exit(1)
  }
  const mode = APPLY ? '🟥 APPLY (escribe en prod)' : VERIFY ? '🟨 VERIFY (read-only)' : '🟦 DRY-RUN (read-only)'
  console.log(`\n📚 Ms. Ellis — suavizar niveles básicos (nivelador + A1 + A2)`)
  console.log(`   API: ${apiUrl}  ·  tenant: ${TENANT_ID}  ·  modo: ${mode}\n`)

  // Switch to the Ms. Ellis tenant.
  const sw = await api('POST', apiUrl, token, '/api/auth/switch-tenant', { tenantId: TENANT_ID })
  const tk = sw.data?.token || token

  // Export the target configs (assert names so we never touch the wrong agent).
  const exportsByKey = {}
  console.log('📦 Exportando configs vivas (nivelador, a1, a2)...')
  for (const k of TARGETS) {
    const full = await api('GET', apiUrl, tk, `/api/v1/mcp/agents/${IDMAP[k]}`)
    const d = full.data || {}
    const ac = d.agentConfig || {}
    if (!/Ms\. Ellis/i.test(d.name || ac.name || '')) {
      throw new Error(`El agente ${IDMAP[k]} (${d.name}) no parece Ms. Ellis — abortando por seguridad.`)
    }
    exportsByKey[k] = { agentId: IDMAP[k], agentConfig: ac }
    console.log(`  ✅ ${k.padEnd(10)} [${d.status}] "${d.name}"`)
    await sleep(500)
  }

  if (VERIFY) {
    for (const k of TARGETS) {
      const blob = (exportsByKey[k].agentConfig.identity?.tone || '') + (exportsByKey[k].agentConfig.identity?.customInstructions || '')
      const ok = k === 'nivelador' ? blob.includes('MUY FÁCIL (nivel A1)') : /~70%|de a poquito/.test(blob)
      console.log(`  ${k.padEnd(10)} suavizado: ${ok ? 'APLICADO ✅' : 'todavía no'}`)
    }
    return
  }

  // Apply the surgical patches (fail loud if any search string isn't found in the LIVE text).
  console.log('\n✏️  Aplicando ediciones (exact-match)...')
  const patchedByKey = {}
  for (const k of TARGETS) {
    patchedByKey[k] = stripNulls(patchConfig(k, exportsByKey[k].agentConfig))
    console.log(`  ✅ ${k}: ${Object.keys(PATCHES[k]).join(', ')} ok`)
  }

  mkdirSync(BACKUP_DIR, { recursive: true })
  for (const k of TARGETS) {
    writeFileSync(join(BACKUP_DIR, `${k}.before.json`), JSON.stringify(exportsByKey[k].agentConfig, null, 2) + '\n')
    writeFileSync(join(BACKUP_DIR, `${k}.after.json`), JSON.stringify(patchedByKey[k], null, 2) + '\n')
  }
  console.log(`\n💾 Backups (before/after) en ${BACKUP_DIR}`)

  console.log('\n── Cambios de tono (antes → después) ──')
  for (const k of TARGETS) {
    console.log(`\n### ${k.toUpperCase()}`)
    console.log(`  ANTES: ${exportsByKey[k].agentConfig.identity.tone}`)
    console.log(`  AHORA: ${patchedByKey[k].identity.tone}`)
  }

  if (!APPLY) {
    console.log(`\n🟦 DRY-RUN ok. Todas las ediciones matchearon. Revisá ${BACKUP_DIR} y corré con --apply.`)
    return
  }

  // Per-agent full-replace import + publish (these agents are STANDALONE; switch_variant
  // routing is baked into each toolConfigs, so a per-agent publish is authoritative).
  for (const k of TARGETS) {
    console.log(`\n🟥 ${k}: import + publish...`)
    await api('PUT', apiUrl, tk, `/api/v1/mcp/agents/${IDMAP[k]}/import`, { agentConfig: patchedByKey[k] })
    await sleep(1200)
    await api('PUT', apiUrl, tk, `/api/v1/mcp/agents/${IDMAP[k]}/publish`, { publish: true })
    console.log(`  ✅ ${k} importado + publicado.`)
    await sleep(1200)
  }

  console.log('\n🔎 Verificando...')
  for (const k of TARGETS) {
    const full = await api('GET', apiUrl, tk, `/api/v1/mcp/agents/${IDMAP[k]}`)
    const ac = full.data?.agentConfig || {}
    const blob = (ac.identity?.tone || '') + (ac.identity?.customInstructions || '')
    const ok = k === 'nivelador' ? /MUY FÁCIL \(nivel A1\)/.test(blob) : /~70%|de a poquito/.test(blob)
    console.log(`  ${k.padEnd(10)} [${full.data?.status}] ${ok ? 'cambios aplicados ✅' : 'NO se ven los cambios ⚠️'}`)
    await sleep(600)
  }
  console.log('\n✅ Listo. Niveles básicos más graduales y en español. B1–C2 sin cambios.')
}

main().catch((e) => {
  console.error(`\n❌ Error: ${e.message}`)
  if (e.cause) console.error(`   cause: ${e.cause.message || e.cause}`)
  process.exit(1)
})
