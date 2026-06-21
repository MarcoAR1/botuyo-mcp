/**
 * audit_agent_family — READ-ONLY config-quality audit for agent families.
 *
 * For each variant's effective config (base deep-merged with the variant overrides) it
 * reports issues without changing anything:
 *   - invalid voice profile (not a known id / display name / Gemini name)   [error]
 *   - non-canonical voice profile (valid but not stored as the id form)     [info]
 *   - customInstructions over the 2000-char limit (silently truncated)      [warning]
 *   - avatar values that are not http(s)/data URLs (won't render)           [warning]
 *   - deprecated AI model id                                                [warning]
 *   - family-of-one with no memoryNamespace (re-materialize → slug)         [info]
 *
 * Rules come from @botuyo/contracts (single source of truth shared with the backend).
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import { resolveVoiceProfile, isDeprecatedModel, normalizeModel } from '@botuyo/contracts'
import type { BotuyoApiClient } from '../client.js'

const BASE = '/api/v1/mcp/agent-families'
/** PromptComposer.sanitizeCustomInstructions truncates customInstructions beyond this. */
const MAX_CUSTOM_INSTRUCTIONS = 2000

export const AUDIT_AGENT_FAMILY_TOOL: Tool = {
  name: 'audit_agent_family',
  description:
    'Read-only audit of agent families for config-quality issues (changes NOTHING). For each variant\'s ' +
    'effective config (base deep-merged with overrides) it reports: invalid or non-canonical voice profiles, ' +
    'customInstructions over the 2000-char limit (silently truncated at runtime), avatar values that are not ' +
    'http(s) URLs, deprecated AI models, and family-of-one members whose memoryNamespace will default to the ' +
    'slug on re-materialize. Pass `familyId` to audit one family, or omit it to audit EVERY family in the ' +
    'current tenant. Available to any authenticated role.',
  inputSchema: {
    type: 'object',
    properties: {
      familyId: { type: 'string', description: 'Audit one family by id. Omit to audit all families in the tenant.' }
    }
  }
}

type Severity = 'error' | 'warning' | 'info'
interface Issue {
  scope: string
  severity: Severity
  code: string
  message: string
}
type Cfg = Record<string, unknown>
interface Variant {
  key?: string
  label?: string
  overrides?: Cfg
}
interface Family {
  _id?: string
  slug?: string
  name?: string
  entryVariantKey?: string
  base?: Cfg
  variants?: Variant[]
}
interface FamilyReport {
  familyId?: string
  slug?: string
  name?: string
  variants: number
  issues: Issue[]
  summary: { errors: number; warnings: number; infos: number }
}

const asObj = (v: unknown): Cfg => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Cfg) : {})
const asStr = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

export async function auditAgentFamilyHandler(client: BotuyoApiClient, args: Record<string, unknown>): Promise<unknown> {
  const familyId = asStr(args.familyId)
  const families = familyId ? [await fetchFamily(client, familyId)] : await fetchAll(client)
  const reports = families.filter((f): f is Family => !!f).map(auditFamily)
  const totals = reports.reduce(
    (a, r) => ({
      errors: a.errors + r.summary.errors,
      warnings: a.warnings + r.summary.warnings,
      infos: a.infos + r.summary.infos
    }),
    { errors: 0, warnings: 0, infos: 0 }
  )
  return { success: true, audited: reports.length, totals, reports }
}

async function fetchFamily(client: BotuyoApiClient, id: string): Promise<Family | null> {
  const res = (await client.get(`${BASE}/${id}`)) as { data?: Family } | Family | null
  if (!res) return null
  const data = (res as { data?: Family }).data
  return data ?? (res as Family)
}

async function fetchAll(client: BotuyoApiClient): Promise<Array<Family | null>> {
  const res = (await client.get(BASE)) as { data?: Family[] } | Family[] | null
  const list = Array.isArray(res) ? res : Array.isArray((res as { data?: Family[] } | null)?.data) ? (res as { data: Family[] }).data : []
  return Promise.all(list.map((f) => fetchFamily(client, String(f._id))))
}

/** Shallow merge with one level of nesting for the audited object fields. */
function mergeConfig(base: Cfg, overrides: Cfg): Cfg {
  const out: Cfg = { ...base, ...overrides }
  for (const k of ['identity', 'voice', 'widgetConfig']) {
    if (base[k] || overrides[k]) out[k] = { ...asObj(base[k]), ...asObj(overrides[k]) }
  }
  return out
}

function auditFamily(fam: Family): FamilyReport {
  const issues: Issue[] = []
  const base = asObj(fam.base)
  const variants = Array.isArray(fam.variants) ? fam.variants : []

  // Family-of-one with no memoryNamespace → re-materialize will set it to the slug.
  if (variants.length === 1) {
    const eff = mergeConfig(base, asObj(variants[0]?.overrides))
    if (!asStr(eff.memoryNamespace)) {
      issues.push({
        scope: `variant:${variants[0]?.key ?? '?'}`,
        severity: 'info',
        code: 'memory_default_slug',
        message: `No memoryNamespace set → re-materialize will default it to the slug "${fam.slug ?? '?'}" (moves the memory bucket off the per-agent default).`
      })
    }
  }

  for (const v of variants) {
    auditConfig(mergeConfig(base, asObj(v.overrides)), `variant:${v.key ?? '?'}`, issues)
  }

  const summary = {
    errors: issues.filter((i) => i.severity === 'error').length,
    warnings: issues.filter((i) => i.severity === 'warning').length,
    infos: issues.filter((i) => i.severity === 'info').length
  }
  return { familyId: fam._id, slug: fam.slug, name: fam.name, variants: variants.length, issues, summary }
}

function auditConfig(cfg: Cfg, scope: string, issues: Issue[]): void {
  // Voice profile
  const profile = asStr(asObj(cfg.voice).profile)
  if (profile) {
    const resolved = resolveVoiceProfile(profile)
    if (!resolved) {
      issues.push({ scope, severity: 'error', code: 'invalid_voice', message: `voice.profile "${profile}" is not a known voice (id / display name / Gemini name).` })
    } else if (resolved.id !== profile) {
      issues.push({ scope, severity: 'info', code: 'noncanonical_voice', message: `voice.profile "${profile}" is valid but not canonical → normalize to id "${resolved.id}".` })
    }
  }

  // Custom instructions length
  const ci = asStr(asObj(cfg.identity).customInstructions)
  if (ci && ci.length > MAX_CUSTOM_INSTRUCTIONS) {
    issues.push({
      scope,
      severity: 'warning',
      code: 'prompt_truncated',
      message: `identity.customInstructions is ${ci.length} chars; the runtime truncates at ${MAX_CUSTOM_INSTRUCTIONS} (loses ${ci.length - MAX_CUSTOM_INSTRUCTIONS} chars).`
    })
  }

  // Avatar values must be http(s)/data URLs
  const wc = asObj(cfg.widgetConfig)
  const candidates: Array<[string, unknown]> = []
  for (const k of ['avatarUrl', 'logoUrl', 'avatar3dUrl']) if (wc[k] !== undefined) candidates.push([`widgetConfig.${k}`, wc[k]])
  for (const [emotion, val] of Object.entries(asObj(wc.avatar2dAnimations))) candidates.push([`avatar2dAnimations.${emotion}`, val])
  for (const [path, val] of candidates) {
    const s = asStr(val)
    if (s && !/^(https?:\/\/|data:)/i.test(s)) {
      issues.push({ scope, severity: 'warning', code: 'non_url_avatar', message: `${path} = "${s}" is not an http(s) URL → it will not render on a widget domain.` })
    }
  }

  // Deprecated AI model
  const model = asStr(cfg.model)
  if (model && isDeprecatedModel(model)) {
    issues.push({ scope, severity: 'warning', code: 'deprecated_model', message: `model "${model}" is deprecated → use "${normalizeModel(model)}".` })
  }
}
