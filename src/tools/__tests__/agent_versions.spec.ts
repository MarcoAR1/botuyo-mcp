import { describe, it, expect } from 'vitest'
import { listAgentVersionsHandler } from '../list_agent_versions.js'
import { restoreAgentVersionHandler } from '../restore_agent_version.js'

// ─── MockClient ───────────────────────────────────────────────────────────

class MockClient {
  public paths: string[] = []
  public payloads: any[] = []

  async get(path: string) {
    this.paths.push(path)
    return {
      success: true,
      data: {
        agentId: 'agent-123',
        versions: [
          { version: 3, changeSource: 'mcp', createdAt: '2026-03-28T20:00:00Z' },
          { version: 2, changeSource: 'api', createdAt: '2026-03-28T19:00:00Z' },
          { version: 1, changeSource: 'system', createdAt: '2026-03-28T18:00:00Z' }
        ],
        total: 3
      }
    }
  }

  async post(path: string, payload: any) {
    this.paths.push(path)
    this.payloads.push(payload)
    return {
      success: true,
      data: { restoredVersion: 2, newSnapshotVersion: 4 },
      message: 'Agent restored to version 2. Current config was saved as v4 before restoring.'
    }
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('list_agent_versions', () => {
  it('should call correct API path', async () => {
    const client = new MockClient()
    const result: any = await listAgentVersionsHandler(client as any, {
      agentId: 'agent-123'
    })

    expect(client.paths[0]).toBe('/api/v1/mcp/agents/agent-123/versions')
    expect(result.success).toBe(true)
    expect(result.data.versions).toHaveLength(3)
    expect(result.data.versions[0].version).toBe(3)
  })
})

describe('restore_agent_version', () => {
  it('should call correct API path with POST', async () => {
    const client = new MockClient()
    const result: any = await restoreAgentVersionHandler(client as any, {
      agentId: 'agent-123',
      version: 2
    })

    expect(client.paths[0]).toBe('/api/v1/mcp/agents/agent-123/versions/2/restore')
    expect(result.success).toBe(true)
    expect(result.data.restoredVersion).toBe(2)
    expect(result.data.newSnapshotVersion).toBe(4)
  })
})
