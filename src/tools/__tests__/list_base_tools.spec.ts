import { describe, it, expect } from 'vitest'
import { getToolsCatalogHandler } from '../list_base_tools.js'

class MockGetClient {
  async get(path: string) {
    expect(path).toBe('/api/v1/mcp/tools/catalog')
    return {
      success: true,
      data: [
        {
          name: 'call_webhook',
          description: 'Calls an external webhook URL',
          configurable: true,
          allowMultiInstance: true,
          configSchema: [
            { key: 'url', type: 'url', label: 'URL del webhook' },
            { key: 'method', type: 'select', label: 'Método HTTP' }
          ],
          requiredIntegrations: null,
          requiresAuth: false
        },
        {
          name: 'google_search',
          description: 'Searches Google',
          configurable: false,
          allowMultiInstance: false,
          configSchema: [],
          requiredIntegrations: null,
          requiresAuth: false
        },
        {
          name: 'send_email',
          description: 'Sends email',
          configurable: true,
          allowMultiInstance: false,
          configSchema: [
            { key: 'fromEmail', type: 'email', label: 'Email remitente' }
          ],
          requiredIntegrations: { category: 'email', label: 'Email provider' },
          requiresAuth: true
        }
      ]
    }
  }
}

describe('getToolsCatalogHandler', () => {
  it('should render the full catalog with badges and config info', async () => {
    const client = new MockGetClient() as any
    const res = await getToolsCatalogHandler(client, {}) as { text: string }
    
    expect(res.text).toContain('Catálogo de tools (3)')
    expect(res.text).toContain('call_webhook')
    expect(res.text).toContain('⚙️ configurable')
    expect(res.text).toContain('🔁 multi-instance')
    expect(res.text).toContain('url(url)')
    expect(res.text).toContain('google_search')
    expect(res.text).toContain('send_email')
    expect(res.text).toContain('Requiere: Email provider')
  })

  it('should filter by configurable when filter=configurable', async () => {
    const client = new MockGetClient() as any
    const res = await getToolsCatalogHandler(client, { filter: 'configurable' }) as { text: string }
    
    expect(res.text).toContain('Catálogo de tools (2)')
    expect(res.text).toContain('call_webhook')
    expect(res.text).toContain('send_email')
    expect(res.text).not.toContain('google_search')
  })

  it('should filter by multi-instance when filter=multi', async () => {
    const client = new MockGetClient() as any
    const res = await getToolsCatalogHandler(client, { filter: 'multi' }) as { text: string }
    
    expect(res.text).toContain('Catálogo de tools (1)')
    expect(res.text).toContain('call_webhook')
    expect(res.text).not.toContain('send_email')
  })
})
