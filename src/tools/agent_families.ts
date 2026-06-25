/**
 * Agent Family MCP tools — manage "one logical agent with many variants".
 *
 * A family holds a shared `base` agent config once; each `variant` stores only
 * its `overrides` (deep-merged over the base when materialized into a real agent).
 * All tools call the MCP namespace `/api/v1/mcp/agent-families`.
 *
 * Write tools (create/update/add/remove/publish/delete/import) require role:
 * owner, admin, or developer (enforced server-side).
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import { buildExportMeta, parseExportMeta, sortVariantsByOrder } from '@botuyo/contracts'
import type { BotuyoApiClient } from '../client.js'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { basename, dirname, join, resolve } from 'path'

const BASE = '/api/v1/mcp/agent-families'

const PARTIAL_CONFIG_DESC =
  'Partial agent config (only the fields that diverge). Same shape as agentConfig: ' +
  'identity {tone,language,objective,customInstructions}, stages, connections, enabledTools, ' +
  'toolConfigs, channels, widgetConfig, voice {profile,widgetCallEnabled}, channelPrompts, ' +
  'knowledgeDocumentIds, memoryNamespace, etc.'

const variantProps = {
  key: { type: 'string', description: 'Stable logical id of the variant (immutable handoff target, e.g. "a1").' },
  label: { type: 'string', description: 'Human label shown in the UI (e.g. "A1 (Beginner)").' },
  overrides: { type: 'object', description: PARTIAL_CONFIG_DESC },
  handoffTargets: {
    type: 'array',
    items: { type: 'string' },
    description: 'Sibling variant keys this variant may switch_variant to.'
  },
  order: { type: 'number', description: 'Display/ordering hint.' }
}

// ── 1. list_agent_families ────────────────────────────────────────────────────
export const LIST_AGENT_FAMILIES_TOOL: Tool = {
  name: 'list_agent_families',
  description:
    'List all agent families (one logical agent = shared base config + variants) for the current tenant.',
  inputSchema: { type: 'object', properties: {} }
}
export async function listAgentFamiliesHandler(client: BotuyoApiClient, _args: Record<string, unknown>) {
  return client.get(BASE)
}

// ── 2. get_agent_family ─────────────────────────────────────────────────────
export const GET_AGENT_FAMILY_TOOL: Tool = {
  name: 'get_agent_family',
  description: 'Get a single agent family (shared base + all variants) by id.',
  inputSchema: {
    type: 'object',
    properties: { familyId: { type: 'string', description: 'The agent family id.' } },
    required: ['familyId']
  }
}
export async function getAgentFamilyHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  return client.get(`${BASE}/${args.familyId as string}`)
}

// ── 3. create_agent_family ──────────────────────────────────────────────────
export const CREATE_AGENT_FAMILY_TOOL: Tool = {
  name: 'create_agent_family',
  description:
    'Create a new agent family with a shared base config and an initial set of variants. ' +
    'Each variant is materialized into a real (draft) agent. Subject to the per-plan ' +
    'maxVariantsPerFamily limit. Requires role: owner, admin, or developer.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Display name of the logical agent (e.g. "Ms. Ellis").' },
      slug: { type: 'string', description: 'URL/identifier slug (e.g. "ms-ellis"); default shared memoryNamespace.' },
      entryVariantKey: { type: 'string', description: 'Which variant owns the public entry. Must match a variant key.' },
      base: { type: 'object', description: `Shared base config inherited by every variant. ${PARTIAL_CONFIG_DESC}` },
      variants: {
        type: 'array',
        description: 'Ordered list of variants. At least one; must include entryVariantKey.',
        items: { type: 'object', properties: variantProps, required: ['key', 'label'] }
      }
    },
    required: ['name', 'slug', 'entryVariantKey', 'variants']
  }
}
export async function createAgentFamilyHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  return client.post(BASE, {
    name: args.name,
    slug: args.slug,
    entryVariantKey: args.entryVariantKey,
    base: args.base ?? {},
    variants: args.variants ?? []
  })
}

// ── 4. update_family_base ───────────────────────────────────────────────────
export const UPDATE_FAMILY_BASE_TOOL: Tool = {
  name: 'update_family_base',
  description:
    'Replace the shared base config of a family. Re-materializes EVERY variant (the base is ' +
    'deep-merged under each variant\'s overrides). Requires role: owner, admin, or developer.',
  inputSchema: {
    type: 'object',
    properties: {
      familyId: { type: 'string', description: 'The agent family id.' },
      base: { type: 'object', description: `New shared base config. ${PARTIAL_CONFIG_DESC}` }
    },
    required: ['familyId', 'base']
  }
}
export async function updateFamilyBaseHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  return client.put(`${BASE}/${args.familyId as string}/base`, { base: args.base ?? {} })
}

// ── 5. add_family_variant ───────────────────────────────────────────────────
export const ADD_FAMILY_VARIANT_TOOL: Tool = {
  name: 'add_family_variant',
  description:
    'Add a new variant to a family (materialized into a real draft agent). Subject to the per-plan ' +
    'maxVariantsPerFamily limit. Requires role: owner, admin, or developer.',
  inputSchema: {
    type: 'object',
    properties: { familyId: { type: 'string', description: 'The agent family id.' }, ...variantProps },
    required: ['familyId', 'key', 'label']
  }
}
export async function addFamilyVariantHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  return client.post(`${BASE}/${args.familyId as string}/variants`, {
    key: args.key,
    label: args.label,
    overrides: args.overrides ?? {},
    handoffTargets: args.handoffTargets,
    order: args.order
  })
}

// ── 6. update_family_variant ────────────────────────────────────────────────
export const UPDATE_FAMILY_VARIANT_TOOL: Tool = {
  name: 'update_family_variant',
  description:
    'Update a single variant (label/overrides/handoffTargets/order) by its key. The variant key itself ' +
    'is immutable. Re-materializes the variant. Requires role: owner, admin, or developer.',
  inputSchema: {
    type: 'object',
    properties: {
      familyId: { type: 'string', description: 'The agent family id.' },
      variantKey: { type: 'string', description: 'The key of the variant to update.' },
      label: variantProps.label,
      overrides: variantProps.overrides,
      handoffTargets: variantProps.handoffTargets,
      order: variantProps.order
    },
    required: ['familyId', 'variantKey']
  }
}
export async function updateFamilyVariantHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  const patch: Record<string, unknown> = {}
  if (args.label !== undefined) patch.label = args.label
  if (args.overrides !== undefined) patch.overrides = args.overrides
  if (args.handoffTargets !== undefined) patch.handoffTargets = args.handoffTargets
  if (args.order !== undefined) patch.order = args.order
  return client.put(`${BASE}/${args.familyId as string}/variants/${args.variantKey as string}`, patch)
}

// ── 7. remove_family_variant ────────────────────────────────────────────────
export const REMOVE_FAMILY_VARIANT_TOOL: Tool = {
  name: 'remove_family_variant',
  description:
    'Remove a variant from a family (soft-deletes its materialized agent). Cannot remove the entry ' +
    'variant — change entryVariantKey first. Requires role: owner, admin, or developer.',
  inputSchema: {
    type: 'object',
    properties: {
      familyId: { type: 'string', description: 'The agent family id.' },
      variantKey: { type: 'string', description: 'The key of the variant to remove.' }
    },
    required: ['familyId', 'variantKey']
  }
}
export async function removeFamilyVariantHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  return client.delete(`${BASE}/${args.familyId as string}/variants/${args.variantKey as string}`)
}

// ── 8. publish_agent_family ─────────────────────────────────────────────────
export const PUBLISH_AGENT_FAMILY_TOOL: Tool = {
  name: 'publish_agent_family',
  description:
    'Publish a family: marks the family and ALL of its member agents as published/active. ' +
    'Requires role: owner, admin, or developer.',
  inputSchema: {
    type: 'object',
    properties: { familyId: { type: 'string', description: 'The agent family id.' } },
    required: ['familyId']
  }
}
export async function publishAgentFamilyHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  return client.put(`${BASE}/${args.familyId as string}/publish`, {})
}

// ── 9. delete_agent_family ──────────────────────────────────────────────────
export const DELETE_AGENT_FAMILY_TOOL: Tool = {
  name: 'delete_agent_family',
  description:
    'Delete a family and soft-delete ALL of its member agents. This action is IRREVERSIBLE.\n\n' +
    '⚠️ Requires explicit confirmation: set `confirm` to true AND provide the exact family name in ' +
    '`confirmName`. Requires role: owner, admin, or developer.',
  inputSchema: {
    type: 'object',
    properties: {
      familyId: { type: 'string', description: 'The agent family id.' },
      confirm: { type: 'boolean', description: 'Must be true to confirm deletion.' },
      confirmName: { type: 'string', description: 'The exact family name (safety confirmation).' }
    },
    required: ['familyId', 'confirm', 'confirmName']
  }
}
export async function deleteAgentFamilyHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  const { familyId, confirm, confirmName } = args
  if (!confirm) {
    return { error: 'Deletion not confirmed. Set confirm=true and provide the family name in confirmName to proceed.' }
  }
  if (!confirmName || typeof confirmName !== 'string' || confirmName.trim().length === 0) {
    return { error: 'Safety check failed: provide the exact family name in confirmName to confirm deletion.' }
  }

  const family = (await client.get(`${BASE}/${familyId as string}`)) as { data?: { name?: string } }
  const actualName = family?.data?.name
  if (!actualName) return { error: `Agent family ${familyId} not found.` }
  if (actualName.trim() !== (confirmName as string).trim()) {
    return {
      error: `Name mismatch: you provided "${confirmName}" but the family is named "${actualName}". Provide the exact name to confirm.`
    }
  }

  const result = await client.delete(`${BASE}/${familyId as string}`)
  return { success: true, message: `Agent family "${actualName}" (${familyId}) has been deleted.`, ...(result as object) }
}

// ── 10. export_agent_family ─────────────────────────────────────────────────
export const EXPORT_AGENT_FAMILY_TOOL: Tool = {
  name: 'export_agent_family',
  description:
    'Export a family to a readable FOLDER: {savePath}/{slug}/family.json (name, slug, entryVariantKey, ' +
    'base + metadata) plus one variants/{key}.json per variant. Default savePath ./agent-families. ' +
    'Edit the files and re-import with import_agent_family (point it at the folder).',
  inputSchema: {
    type: 'object',
    properties: {
      familyId: { type: 'string', description: 'The agent family id.' },
      savePath: { type: 'string', description: 'Optional parent directory for the saved family folder. Default: ./agent-families/' }
    },
    required: ['familyId']
  }
}
export async function exportAgentFamilyHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  const familyId = args.familyId as string
  const savePath = (args.savePath as string) || './agent-families'

  const result = (await client.get(`${BASE}/${familyId}/export`)) as {
    success?: boolean
    data?: { familyId?: string; family?: Record<string, unknown> & { slug?: string; variants?: Array<Record<string, unknown>> } }
    message?: string
    savedTo?: string
    fileSaveError?: string
  }

  if (result?.success && result?.data?.family) {
    try {
      const family = result.data.family
      const slug = sanitizeName(family.slug || familyId)
      const famDir = join(resolve(savePath), slug)
      const variantsDir = join(famDir, 'variants')
      mkdirSync(variantsDir, { recursive: true })

      const variants = Array.isArray(family.variants) ? family.variants : []
      const { variants: _variants, ...familyMeta } = family
      void _variants
      // family.json: versioned _meta envelope + metadata + base, WITHOUT the (huge) variants array
      const familyJson = {
        _meta: buildExportMeta({ slug: family.slug, familyId: result.data.familyId }),
        ...familyMeta
      }
      writeFileSync(join(famDir, 'family.json'), JSON.stringify(familyJson, null, 2), 'utf-8')
      // one file per variant — small, readable, clean diffs
      for (const variant of variants) {
        const key = sanitizeName(String((variant as { key?: unknown }).key ?? 'variant'))
        writeFileSync(join(variantsDir, `${key}.json`), JSON.stringify(variant, null, 2), 'utf-8')
      }

      result.savedTo = famDir
      result.message = `${result.message || ''} Saved family.json + ${variants.length} variant file(s) to: ${famDir}`
    } catch (err: unknown) {
      result.fileSaveError = `Could not save folder: ${err instanceof Error ? err.message : String(err)}`
    }
  }

  return result
}

// ── 11. import_agent_family ─────────────────────────────────────────────────
export const IMPORT_AGENT_FAMILY_TOOL: Tool = {
  name: 'import_agent_family',
  description:
    'Import/replace a family\'s base + variant set from a local FOLDER, a single JSON file, or an inline object (FULL REPLACE).\n\n' +
    'Reconciles members: surviving variant keys keep their materialized agent, new keys are created, ' +
    'dropped keys are soft-deleted. Subject to the per-plan maxVariantsPerFamily limit.\n\n' +
    'Provide the family via `filePath` (preferred — a folder from export_agent_family: family.json + variants/*.json; ' +
    'a single legacy .json also works) or inline `family`. If both are given, filePath wins. ' +
    'If NO familyId is resolved (no arg and no _meta/_familyId in the file), a NEW family is CREATED from ' +
    'the payload (requires entryVariantKey + at least one variant) — author a committed agent folder straight from disk. ' +
    'Requires role: owner, admin, or developer.',
  inputSchema: {
    type: 'object',
    properties: {
      familyId: {
        type: 'string',
        description:
          'The family id to overwrite. If omitted and the file contains _familyId/_meta.familyId, that is used. ' +
          'If still missing, a NEW family is created from the payload (needs entryVariantKey + ≥1 variant).'
      },
      filePath: { type: 'string', description: 'Path to a family folder (e.g. ./agent-families/ms-ellis), its family.json, or a single .json file.' },
      family: {
        type: 'object',
        description: 'Inline family payload (fallback if filePath is omitted).',
        properties: {
          name: { type: 'string' },
          slug: { type: 'string' },
          entryVariantKey: { type: 'string', description: 'Must match one of the variant keys.' },
          base: { type: 'object', description: PARTIAL_CONFIG_DESC },
          variants: { type: 'array', items: { type: 'object', properties: variantProps, required: ['key', 'label'] } }
        },
        required: ['entryVariantKey', 'variants']
      }
    }
  }
}
export async function importAgentFamilyHandler(client: BotuyoApiClient, args: Record<string, unknown>) {
  let familyId = args.familyId as string | undefined
  let family = args.family as Record<string, unknown> | undefined

  const filePath = args.filePath as string | undefined
  if (filePath) {
    const resolvedPath = resolve(filePath)
    if (!existsSync(resolvedPath)) {
      return {
        success: false,
        error: `Path not found: ${resolvedPath}`,
        hint: 'Use export_agent_family first to create a local family folder, or check the path.'
      }
    }
    try {
      const parsed = readFamilyFromPath(resolvedPath)
      // Resolve provenance via the shared contract (versioned `_meta` or legacy `_familyId`).
      if (!familyId) familyId = parseExportMeta(parsed).familyId
      // Strip provenance fields so only authoring content reaches the API.
      const { _exportedAt, _familyId, _meta, ...content } = parsed
      void _exportedAt
      void _familyId
      void _meta
      family = content
    } catch (err: unknown) {
      return { success: false, error: `Failed to read/parse: ${err instanceof Error ? err.message : String(err)}`, path: resolvedPath }
    }
  }

  if (!family) {
    return { success: false, error: 'No family payload. Use filePath to point to a local JSON file/folder, or provide family inline.' }
  }

  // No familyId (none passed, none in _meta/_familyId) → CREATE a brand-new family from the
  // payload, as long as it carries enough to create (entryVariantKey + at least one variant). This
  // lets a committed agent FOLDER be authored straight from disk without first calling
  // create_agent_family. Anything less still errors (the caller likely forgot the id to overwrite).
  if (!familyId) {
    const variants = Array.isArray(family.variants) ? (family.variants as unknown[]) : []
    if (family.entryVariantKey && variants.length > 0) {
      const created = await client.post(BASE, {
        name: family.name,
        slug: family.slug,
        entryVariantKey: family.entryVariantKey,
        base: family.base ?? {},
        variants
      })
      return { ...(created as object), createdFrom: filePath ? resolve(filePath) : 'inline' }
    }
    return {
      success: false,
      error:
        'familyId is required to overwrite an existing family. To CREATE a new family, include entryVariantKey + at least one variant (plus name/slug).'
    }
  }

  const result = await client.put(`${BASE}/${familyId}/import`, family)
  return { ...(result as object), importedFrom: filePath ? resolve(filePath) : 'inline' }
}

// ── helpers ─────────────────────────────────────────────────────────────────

/** Make a slug/variant key safe to use as a file/directory name. */
function sanitizeName(name: string): string {
  const cleaned = String(name)
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
  return cleaned || 'family'
}

/**
 * Read a family payload from a path that may be:
 *  - a folder (family.json + variants/*.json) → reassembled with a `variants` array,
 *  - a `family.json` file → its parent folder is reassembled,
 *  - a single legacy .json file (variants inline) → parsed as-is.
 */
function readFamilyFromPath(resolvedPath: string): Record<string, unknown> {
  const stat = statSync(resolvedPath)
  if (stat.isDirectory()) return readFamilyFromFolder(resolvedPath)
  if (basename(resolvedPath).toLowerCase() === 'family.json') return readFamilyFromFolder(dirname(resolvedPath))
  return JSON.parse(readFileSync(resolvedPath, 'utf-8')) as Record<string, unknown>
}

/** Reassemble a folder (family.json + variants/*.json) into a single family object. */
function readFamilyFromFolder(dir: string): Record<string, unknown> {
  const familyJsonPath = join(dir, 'family.json')
  if (!existsSync(familyJsonPath)) {
    throw new Error(`family.json not found in folder: ${dir}`)
  }
  const family = JSON.parse(readFileSync(familyJsonPath, 'utf-8')) as Record<string, unknown>

  const variantsDir = join(dir, 'variants')
  const variants: Array<Record<string, unknown>> = []
  if (existsSync(variantsDir) && statSync(variantsDir).isDirectory()) {
    const files = readdirSync(variantsDir)
      .filter((f) => f.toLowerCase().endsWith('.json'))
      .sort()
    for (const file of files) {
      variants.push(JSON.parse(readFileSync(join(variantsDir, file), 'utf-8')) as Record<string, unknown>)
    }
  }
  // Variant filenames are arbitrary; the source of truth for sequence is each variant's
  // `order`. Stable-sort by order (order-less variants sink to the end) via the shared contract.
  return { ...family, variants: sortVariantsByOrder(variants as Array<{ order?: number }>) }
}
