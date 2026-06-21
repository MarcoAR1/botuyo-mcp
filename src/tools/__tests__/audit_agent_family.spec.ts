import { describe, it, expect } from 'vitest'
import { auditAgentFamilyHandler } from '../audit_agent_family.js'

/** MockClient that returns a canned response per path and records the paths hit. */
class MockClient {
  public paths: string[] = []
  constructor(private readonly responses: Record<string, unknown>) {}
  async get(path: string): Promise<unknown> {
    this.paths.push(path)
    return this.responses[path] ?? { success: true, data: null }
  }
  async post(): Promise<unknown> {
    return { success: true }
  }
  async put(): Promise<unknown> {
    return { success: true }
  }
  async delete(): Promise<unknown> {
    return { success: true }
  }
}

const familyWithIssues = {
  _id: 'fam1',
  slug: 'demo',
  name: 'Demo',
  entryVariantKey: 'default',
  base: {},
  variants: [
    {
      key: 'default',
      label: 'Default',
      overrides: {
        voice: { profile: 'Voz Inexistente' }, // invalid → error
        identity: { customInstructions: 'x'.repeat(2500) }, // > 2000 → warning
        model: 'gemini-2.0-flash', // deprecated → warning
        widgetConfig: {
          avatarUrl: 'https://cdn.example.com/a.png', // ok
          avatar2dAnimations: { happy: 'agents/emotions/x.png' } // not a URL → warning
        }
        // no memoryNamespace + single variant → info
      }
    }
  ]
}

describe('audit_agent_family', () => {
  it('flags invalid voice, prompt truncation, deprecated model, non-URL avatar, and memoryNamespace default', async () => {
    const client = new MockClient({ '/api/v1/mcp/agent-families/fam1': { success: true, data: familyWithIssues } })
    const res = (await auditAgentFamilyHandler(client as never, { familyId: 'fam1' })) as {
      audited: number
      totals: { errors: number; warnings: number; infos: number }
      reports: Array<{ issues: Array<{ code: string }> }>
    }

    expect(client.paths).toContain('/api/v1/mcp/agent-families/fam1')
    const codes = res.reports[0].issues.map((i) => i.code)
    expect(codes).toContain('invalid_voice')
    expect(codes).toContain('prompt_truncated')
    expect(codes).toContain('deprecated_model')
    expect(codes).toContain('non_url_avatar')
    expect(codes).toContain('memory_default_slug')
    expect(res.totals.errors).toBeGreaterThanOrEqual(1)
  })

  it('flags a valid-but-non-canonical voice (display name) as info, not error', async () => {
    const fam = {
      _id: 'f3',
      slug: 'hilton',
      name: 'Hilton',
      entryVariantKey: 'default',
      base: { memoryNamespace: 'hilton' },
      variants: [{ key: 'default', label: 'D', overrides: { voice: { profile: 'Profesional Femenina' } } }]
    }
    const client = new MockClient({ '/api/v1/mcp/agent-families/f3': { success: true, data: fam } })
    const res = (await auditAgentFamilyHandler(client as never, { familyId: 'f3' })) as {
      reports: Array<{ issues: Array<{ code: string; severity: string }> }>
    }
    const codes = res.reports[0].issues.map((i) => i.code)
    expect(codes).toContain('noncanonical_voice')
    expect(codes).not.toContain('invalid_voice')
  })

  it('reports zero issues for a clean family (canonical voice id, short prompt, URL avatar, memoryNamespace set)', async () => {
    const clean = {
      _id: 'f2',
      slug: 'clean',
      name: 'Clean',
      entryVariantKey: 'default',
      base: { memoryNamespace: 'clean' },
      variants: [
        {
          key: 'default',
          label: 'D',
          overrides: {
            voice: { profile: 'kore' },
            identity: { customInstructions: 'short' },
            widgetConfig: { avatarUrl: 'https://cdn.example.com/a.png' }
          }
        }
      ]
    }
    const client = new MockClient({ '/api/v1/mcp/agent-families/f2': { success: true, data: clean } })
    const res = (await auditAgentFamilyHandler(client as never, { familyId: 'f2' })) as {
      reports: Array<{ issues: unknown[] }>
    }
    expect(res.reports[0].issues).toHaveLength(0)
  })

  it('audits every family in the tenant when familyId is omitted', async () => {
    const client = new MockClient({
      '/api/v1/mcp/agent-families': { success: true, data: [{ _id: 'fam1' }] },
      '/api/v1/mcp/agent-families/fam1': { success: true, data: familyWithIssues }
    })
    const res = (await auditAgentFamilyHandler(client as never, {})) as { audited: number }
    expect(client.paths).toContain('/api/v1/mcp/agent-families')
    expect(client.paths).toContain('/api/v1/mcp/agent-families/fam1')
    expect(res.audited).toBe(1)
  })
})
