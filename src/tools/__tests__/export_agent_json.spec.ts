import { describe, it, expect, afterEach } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { exportAgentJsonHandler } from '../export_agent_json.js'

class MockClient {
  public paths: string[] = []
  constructor(private responses: Record<string, unknown> = {}) {}
  async get(path: string) {
    this.paths.push(path)
    return this.responses[path] ?? { success: true, data: {} }
  }
}

const tmpDirs: string[] = []
function makeTmpDir() {
  const d = mkdtempSync(join(tmpdir(), 'exp-'))
  tmpDirs.push(d)
  return d
}
afterEach(() => {
  while (tmpDirs.length) rmSync(tmpDirs.pop() as string, { recursive: true, force: true })
})

describe('exportAgentJsonHandler — unified (everything is a family)', () => {
  it('delegates to the family export (uniform folder) when the agent belongs to a family', async () => {
    const dir = makeTmpDir()
    const client = new MockClient({
      '/api/v1/mcp/agents/a1': { success: true, data: { familyId: 'fam1' } },
      '/api/v1/mcp/agent-families/fam1/export': {
        success: true,
        data: {
          familyId: 'fam1',
          family: {
            name: 'Bot',
            slug: 'bot',
            entryVariantKey: 'default',
            base: {},
            variants: [{ key: 'default', label: 'Bot', overrides: {}, order: 0 }]
          }
        }
      }
    }) as any

    const res = (await exportAgentJsonHandler(client, { agentId: 'a1', savePath: dir })) as any

    // resolves agentId → familyId, then exports the whole logical agent as a folder
    expect(client.paths).toContain('/api/v1/mcp/agents/a1')
    expect(client.paths).toContain('/api/v1/mcp/agent-families/fam1/export')
    const famDir = join(dir, 'bot')
    expect(res.savedTo).toBe(famDir)
    expect(existsSync(join(famDir, 'family.json'))).toBe(true)
    // simple agent = exactly one variant file
    expect(existsSync(join(famDir, 'variants', 'default.json'))).toBe(true)
  })

  it('falls back to the legacy single-file export for a standalone agent (no familyId)', async () => {
    const dir = makeTmpDir()
    const client = new MockClient({
      '/api/v1/mcp/agents/a1': { success: true, data: { familyId: null } },
      '/api/v1/mcp/agents/a1/export': {
        success: true,
        data: { agentId: 'a1', apiKey: 'key', agentConfig: { name: 'Test Bot' } }
      }
    }) as any

    const res = (await exportAgentJsonHandler(client, { agentId: 'a1', savePath: dir })) as any

    expect(res.success).toBe(true)
    const file = join(dir, 'test_bot.json')
    expect(existsSync(file)).toBe(true)
    const saved = JSON.parse(readFileSync(file, 'utf-8'))
    expect(saved._agentId).toBe('a1')
    expect(saved.name).toBe('Test Bot')
  })
})
