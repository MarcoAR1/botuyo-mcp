import { describe, it, expect, afterEach } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { importAgentJsonHandler } from '../import_agent_json.js'

class MockPutClient {
  public methodCalls: any[] = []
  async put(path: string, payload: any) {
    this.methodCalls.push({ path, payload })
    return { success: true }
  }
}

const tmpDirs: string[] = []
function makeTmpDir() {
  const d = mkdtempSync(join(tmpdir(), 'imp-'))
  tmpDirs.push(d)
  return d
}
afterEach(() => {
  while (tmpDirs.length) rmSync(tmpDirs.pop() as string, { recursive: true, force: true })
})

describe('importAgentJsonHandler', () => {
  it('should process inline config successfully (legacy single-agent member import)', async () => {
    const client = new MockPutClient() as any
    const args = {
      agentId: 'a1',
      agentConfig: { name: 'Inline Agent', identity: { language: 'es' } }
    }

    const res = await importAgentJsonHandler(client, args)

    expect(client.methodCalls[0].path).toBe('/api/v1/mcp/agents/a1/import')
    expect(client.methodCalls[0].payload.agentConfig.name).toBe('Inline Agent')
    expect((res as any).success).toBe(true)
  })

  it('should return error if missing agentId', async () => {
    const res = await importAgentJsonHandler({} as any, { agentConfig: {} })
    expect((res as any).success).toBe(false)
    expect((res as any).error).toContain('agentId is required')
  })

  it('delegates to the family importer when filePath is a family folder', async () => {
    const dir = makeTmpDir()
    const famDir = join(dir, 'bot')
    mkdirSync(join(famDir, 'variants'), { recursive: true })
    writeFileSync(
      join(famDir, 'family.json'),
      JSON.stringify({ _meta: { schema: 'botuyo.agent/v1', familyId: 'fam1', slug: 'bot' }, entryVariantKey: 'default', base: {} })
    )
    writeFileSync(join(famDir, 'variants', 'default.json'), JSON.stringify({ key: 'default', label: 'Bot', overrides: {}, order: 0 }))

    const client = new MockPutClient() as any
    await importAgentJsonHandler(client, { filePath: famDir })

    // familyId comes from the _meta envelope → routed to the family importer (not the member import)
    expect(client.methodCalls[0].path).toBe('/api/v1/mcp/agent-families/fam1/import')
    expect(client.methodCalls[0].payload._meta).toBeUndefined()
    expect(client.methodCalls[0].payload.variants).toHaveLength(1)
  })
})
