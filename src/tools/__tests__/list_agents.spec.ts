import { describe, it, expect } from 'vitest'
import { listAgentsHandler } from '../list_agents.js'

class MockClient {
  async get(path: string) {
    expect(path).toBe('/api/v1/mcp/agents')
    return {
      success: true,
      data: [
        { id: '6988e1877a3c2a943468b9e2', name: 'Nivelador', status: 'published', enabledToolsCount: 3 }
      ]
    }
  }
}

describe('listAgentsHandler', () => {
  it('should call GET /api/v1/mcp/agents and keep a data array', async () => {
    const client = new MockClient() as any
    const res = (await listAgentsHandler(client, {})) as any
    expect(Array.isArray(res.data)).toBe(true)
    expect(res.count).toBe(1)
  })

  it('adds a shortId to each agent without losing the full id', async () => {
    const client = new MockClient() as any
    const res = (await listAgentsHandler(client, {})) as any
    expect(res.data[0].id).toBe('6988e1877a3c2a943468b9e2')
    expect(res.data[0].shortId).toBe('6988e187…b9e2')
  })

  it('returns a name-first text summary', async () => {
    const client = new MockClient() as any
    const res = (await listAgentsHandler(client, {})) as any
    expect(res.text).toContain('Nivelador')
    expect(res.text).toContain('6988e187…b9e2')
    expect(res.text).toContain('published')
  })
})

class MockClientFamily {
  async get(path: string) {
    expect(path).toBe('/api/v1/mcp/agents')
    return {
      success: true,
      data: [
        {
          id: '6a31f42d0bff04d6abbd5d7f',
          name: 'Ms. Ellis — A1 (Beginner)',
          status: 'published',
          enabledToolsCount: 5,
          familyId: '6a344975524b9e2d93406f40',
          variantKey: 'a1'
        },
        {
          id: '69f20e5d0000000000000000',
          name: 'Hilton Concierge',
          status: 'published',
          enabledToolsCount: 2,
          familyId: null,
          variantKey: null
        }
      ]
    }
  }
}

describe('listAgentsHandler — family membership', () => {
  it('tags family members with their variantKey in the text summary', async () => {
    const client = new MockClientFamily() as any
    const res = (await listAgentsHandler(client, {})) as any
    const lines = res.text.split('\n')
    expect(lines[0]).toContain('Ms. Ellis — A1 (Beginner)')
    expect(lines[0].toLowerCase()).toContain('family')
    expect(lines[0]).toContain('a1')
  })

  it('does NOT add a family tag to standalone agents', async () => {
    const client = new MockClientFamily() as any
    const res = (await listAgentsHandler(client, {})) as any
    const lines = res.text.split('\n')
    expect(lines[1]).toContain('Hilton Concierge')
    expect(lines[1].toLowerCase()).not.toContain('family')
  })

  it('keeps familyId/variantKey in the structured data', async () => {
    const client = new MockClientFamily() as any
    const res = (await listAgentsHandler(client, {})) as any
    expect(res.data[0].familyId).toBe('6a344975524b9e2d93406f40')
    expect(res.data[0].variantKey).toBe('a1')
    expect(res.data[1].familyId).toBeNull()
  })
})
