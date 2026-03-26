import { describe, it, expect } from 'vitest'
import { listBaseToolsHandler } from '../list_base_tools.js'

class MockGetClient {
  async get(path: string) {
    expect(path).toBe('/api/v1/mcp/tools/base')
    return {
      success: true,
      data: {
        sync_document: {
          connectors: ['google_sheets', 'notion'],
          description: 'Sincronizar doc'
        },
        call_webhook: {}
      }
    }
  }
}

describe('listBaseToolsHandler', () => {
  it('should render base tools with their connectors', async () => {
    const client = new MockGetClient() as any
    const res = await listBaseToolsHandler(client, {}) as { text: string }
    
    expect(res.text).toContain('Base tools disponibles')
    expect(res.text).toContain('sync_document')
    expect(res.text).toContain('Connectors: google_sheets, notion')
    expect(res.text).toContain('call_webhook')
    expect(res.text).toContain('Connectors: —')
  })
})
