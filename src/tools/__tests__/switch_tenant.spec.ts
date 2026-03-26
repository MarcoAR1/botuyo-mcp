import { vi, describe, it, expect } from 'vitest'
import { switchTenantHandler } from '../switch_tenant.js'

vi.mock('../commands/credentials.js', () => ({
  readCredentials: vi.fn(() => ({ token: 'mock-token', tenantId: 't1' })),
  saveCredentials: vi.fn()
}))

global.fetch = vi.fn(() => Promise.resolve({
  json: () => Promise.resolve({ success: true, data: { name: 'Target Tenant Name' } })
})) as any

class MockClient {
  public methodCalls: any[] = []
  async get(path: string) {
    this.methodCalls.push({ method: 'GET', path })
    if (path === '/api/auth/me') return { success: true, data: { user: { tenantIds: ['t1', 't2'], roles: [] } } }
    return { success: true, data: {} }
  }
  async post(path: string, payload: any) {
    this.methodCalls.push({ method: 'POST', path, payload })
    return { success: true, data: { token: 'new-token' } }
  }
  setToken() {}
}

describe('switchTenantHandler', () => {
  it('should list tenants when no tenantId provided', async () => {
    const client = new MockClient() as any
    const res = await switchTenantHandler(client, {})
    expect((res as any).success).toBe(true)
    expect((res as any).tenants.length).toBe(2)
  })
})
