import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  listAgentFamiliesHandler,
  getAgentFamilyHandler,
  createAgentFamilyHandler,
  updateFamilyBaseHandler,
  addFamilyVariantHandler,
  updateFamilyVariantHandler,
  removeFamilyVariantHandler,
  publishAgentFamilyHandler,
  deleteAgentFamilyHandler,
  exportAgentFamilyHandler,
  importAgentFamilyHandler
} from '../agent_families.js'

type Call = { method: string; path: string; payload?: any }

class MockClient {
  public calls: Call[] = []
  constructor(private getResponses: Record<string, any> = {}) {}
  async get(path: string) {
    this.calls.push({ method: 'get', path })
    return this.getResponses[path] ?? { success: true, data: {} }
  }
  async post(path: string, payload: any) {
    this.calls.push({ method: 'post', path, payload })
    return { success: true, data: payload }
  }
  async put(path: string, payload: any) {
    this.calls.push({ method: 'put', path, payload })
    return { success: true, data: payload }
  }
  async delete(path: string) {
    this.calls.push({ method: 'delete', path })
    return { success: true }
  }
}

const BASE = '/api/v1/mcp/agent-families'
const tmpDirs: string[] = []
function makeTmpDir() {
  const d = mkdtempSync(join(tmpdir(), 'fam-'))
  tmpDirs.push(d)
  return d
}
afterEach(() => {
  while (tmpDirs.length) rmSync(tmpDirs.pop() as string, { recursive: true, force: true })
})

describe('agent family tools — read', () => {
  it('list calls GET /agent-families', async () => {
    const client = new MockClient() as any
    await listAgentFamiliesHandler(client, {})
    expect(client.calls[0]).toEqual({ method: 'get', path: BASE })
  })

  it('get calls GET /agent-families/:id', async () => {
    const client = new MockClient() as any
    await getAgentFamilyHandler(client, { familyId: 'fam1' })
    expect(client.calls[0]).toEqual({ method: 'get', path: `${BASE}/fam1` })
  })
})

describe('agent family tools — create / base', () => {
  it('create posts the full family payload', async () => {
    const client = new MockClient() as any
    const args = {
      name: 'Ms. Ellis',
      slug: 'ms-ellis',
      entryVariantKey: 'nivelador',
      base: { identity: { tone: 'cálida' } },
      variants: [{ key: 'nivelador', label: 'Nivelador', overrides: {} }]
    }
    await createAgentFamilyHandler(client, args)
    expect(client.calls[0].method).toBe('post')
    expect(client.calls[0].path).toBe(BASE)
    expect(client.calls[0].payload).toMatchObject({
      name: 'Ms. Ellis',
      slug: 'ms-ellis',
      entryVariantKey: 'nivelador',
      base: { identity: { tone: 'cálida' } }
    })
    expect(client.calls[0].payload.variants).toHaveLength(1)
  })

  it('create defaults base/variants when omitted', async () => {
    const client = new MockClient() as any
    await createAgentFamilyHandler(client, { name: 'X', slug: 'x', entryVariantKey: 'k' })
    expect(client.calls[0].payload.base).toEqual({})
    expect(client.calls[0].payload.variants).toEqual([])
  })

  it('update_family_base puts { base } to /base', async () => {
    const client = new MockClient() as any
    await updateFamilyBaseHandler(client, { familyId: 'fam1', base: { enabledTools: ['save_user_memory'] } })
    expect(client.calls[0]).toEqual({
      method: 'put',
      path: `${BASE}/fam1/base`,
      payload: { base: { enabledTools: ['save_user_memory'] } }
    })
  })
})

describe('agent family tools — variants', () => {
  it('add_family_variant posts the variant to /variants', async () => {
    const client = new MockClient() as any
    await addFamilyVariantHandler(client, {
      familyId: 'fam1',
      key: 'a2',
      label: 'A2',
      overrides: { knowledgeDocumentIds: ['d'] },
      handoffTargets: ['nivelador'],
      order: 3
    })
    expect(client.calls[0].method).toBe('post')
    expect(client.calls[0].path).toBe(`${BASE}/fam1/variants`)
    expect(client.calls[0].payload).toMatchObject({
      key: 'a2',
      label: 'A2',
      overrides: { knowledgeDocumentIds: ['d'] },
      handoffTargets: ['nivelador'],
      order: 3
    })
  })

  it('update_family_variant puts only provided fields to /variants/:key', async () => {
    const client = new MockClient() as any
    await updateFamilyVariantHandler(client, { familyId: 'fam1', variantKey: 'a1', label: 'A1+' })
    expect(client.calls[0].method).toBe('put')
    expect(client.calls[0].path).toBe(`${BASE}/fam1/variants/a1`)
    expect(client.calls[0].payload).toEqual({ label: 'A1+' })
  })

  it('remove_family_variant deletes /variants/:key', async () => {
    const client = new MockClient() as any
    await removeFamilyVariantHandler(client, { familyId: 'fam1', variantKey: 'a1' })
    expect(client.calls[0]).toEqual({ method: 'delete', path: `${BASE}/fam1/variants/a1` })
  })
})

describe('agent family tools — publish / delete', () => {
  it('publish puts to /publish', async () => {
    const client = new MockClient() as any
    await publishAgentFamilyHandler(client, { familyId: 'fam1' })
    expect(client.calls[0]).toEqual({ method: 'put', path: `${BASE}/fam1/publish`, payload: {} })
  })

  it('delete refuses without confirm', async () => {
    const client = new MockClient() as any
    const res = (await deleteAgentFamilyHandler(client, { familyId: 'fam1', confirmName: 'Ms. Ellis' })) as any
    expect(res.error).toBeTruthy()
    expect(client.calls.some((c: Call) => c.method === 'delete')).toBe(false)
  })

  it('delete refuses on name mismatch', async () => {
    const client = new MockClient({ [`${BASE}/fam1`]: { success: true, data: { name: 'Ms. Ellis' } } }) as any
    const res = (await deleteAgentFamilyHandler(client, { familyId: 'fam1', confirm: true, confirmName: 'Wrong' })) as any
    expect(res.error).toMatch(/mismatch/i)
    expect(client.calls.some((c: Call) => c.method === 'delete')).toBe(false)
  })

  it('delete proceeds when confirmed + name matches', async () => {
    const client = new MockClient({ [`${BASE}/fam1`]: { success: true, data: { name: 'Ms. Ellis' } } }) as any
    const res = (await deleteAgentFamilyHandler(client, {
      familyId: 'fam1',
      confirm: true,
      confirmName: 'Ms. Ellis'
    })) as any
    expect(res.success).toBe(true)
    expect(client.calls.some((c: Call) => c.method === 'delete' && c.path === `${BASE}/fam1`)).toBe(true)
  })
})

describe('agent family tools — export / import', () => {
  it('export GETs /export and saves a portable file', async () => {
    const dir = makeTmpDir()
    const client = new MockClient({
      [`${BASE}/fam1/export`]: {
        success: true,
        data: {
          familyId: 'fam1',
          family: {
            name: 'Ms. Ellis',
            slug: 'ms-ellis',
            entryVariantKey: 'nivelador',
            base: {},
            variants: [{ key: 'nivelador', label: 'Nivelador', overrides: {} }]
          }
        }
      }
    }) as any

    const res = (await exportAgentFamilyHandler(client, { familyId: 'fam1', savePath: dir })) as any
    expect(client.calls[0]).toEqual({ method: 'get', path: `${BASE}/fam1/export` })
    expect(res.savedTo).toBe(join(dir, 'ms-ellis.json'))
    const saved = JSON.parse(readFileSync(res.savedTo, 'utf-8'))
    expect(saved._familyId).toBe('fam1')
    expect(saved.entryVariantKey).toBe('nivelador')
  })

  it('import (inline) PUTs the family to /import', async () => {
    const client = new MockClient() as any
    const family = {
      entryVariantKey: 'nivelador',
      base: {},
      variants: [{ key: 'nivelador', label: 'N', overrides: {} }]
    }
    await importAgentFamilyHandler(client, { familyId: 'fam1', family })
    expect(client.calls[0].method).toBe('put')
    expect(client.calls[0].path).toBe(`${BASE}/fam1/import`)
    expect(client.calls[0].payload).toEqual(family)
  })

  it('import (file) reads the file, strips metadata, and derives familyId from _familyId', async () => {
    const dir = makeTmpDir()
    const file = join(dir, 'ms-ellis.json')
    writeFileSync(
      file,
      JSON.stringify({
        _exportedAt: '2026-06-18T00:00:00.000Z',
        _familyId: 'fam-from-file',
        name: 'Ms. Ellis',
        slug: 'ms-ellis',
        entryVariantKey: 'nivelador',
        base: {},
        variants: [{ key: 'nivelador', label: 'N', overrides: {} }]
      }),
      'utf-8'
    )

    const client = new MockClient() as any
    const res = (await importAgentFamilyHandler(client, { filePath: file })) as any
    expect(client.calls[0].path).toBe(`${BASE}/fam-from-file/import`)
    expect(client.calls[0].payload._exportedAt).toBeUndefined()
    expect(client.calls[0].payload._familyId).toBeUndefined()
    expect(client.calls[0].payload.entryVariantKey).toBe('nivelador')
    expect(res.importedFrom).toBe(file)
  })

  it('import errors when neither familyId nor _familyId is available', async () => {
    const client = new MockClient() as any
    const res = (await importAgentFamilyHandler(client, {
      family: { entryVariantKey: 'k', base: {}, variants: [] }
    })) as any
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/familyId is required/i)
    expect(client.calls.some((c: Call) => c.method === 'put')).toBe(false)
  })
})
