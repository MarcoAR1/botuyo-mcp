import { describe, it, expect } from 'vitest'
import { updateAgentHandler, UPDATE_AGENT_TOOL } from '../update_agent.js'

class MockClient {
  public methodCalls: any[] = []
  async put(path: string, payload: any) {
    this.methodCalls.push({ path, payload })
    return { success: true }
  }
}

describe('updateAgentHandler', () => {
  it('should call PUT /api/v1/mcp/agents/:id', async () => {
    const client = new MockClient() as any
    const args = { agentId: 'a1', name: 'New Name', identity: { tone: 'friendly' } }
    
    await updateAgentHandler(client, args)
    
    expect(client.methodCalls[0].path).toBe('/api/v1/mcp/agents/a1')
    expect(client.methodCalls[0].payload.name).toBe('New Name')
    expect(client.methodCalls[0].payload.identity.tone).toBe('friendly')
  })

  it('should require agentId', async () => {
    await expect(updateAgentHandler({} as any, {})).rejects.toThrow()
  })

  it('forwards requiresUserIdentity in the update payload', async () => {
    const client = new MockClient() as any
    await updateAgentHandler(client, { agentId: 'a1', requiresUserIdentity: true })

    expect(client.methodCalls[0].path).toBe('/api/v1/mcp/agents/a1')
    expect(client.methodCalls[0].payload.requiresUserIdentity).toBe(true)
  })

  it('advertises endUserAuth in the inputSchema', () => {
    const props = (UPDATE_AGENT_TOOL.inputSchema as any).properties
    expect(props.endUserAuth).toBeDefined()
    expect(props.endUserAuth.type).toBe('object')
    // the key nested fields the assistant must know it can set
    expect(props.endUserAuth.properties.mode).toBeDefined()
    expect(props.endUserAuth.properties.jwksUrl).toBeDefined()
    expect(props.endUserAuth.properties.sharedSecret).toBeDefined()
    expect(props.endUserAuth.properties.issuer).toBeDefined()
    expect(props.endUserAuth.properties.claims).toBeDefined()
    // callback mode (delegated verification to the customer's https endpoint)
    expect(props.endUserAuth.properties.mode.enum).toContain('callback')
    expect(props.endUserAuth.properties.callbackUrl).toBeDefined()
    expect(props.endUserAuth.properties.callbackCacheTtlSeconds).toBeDefined()
  })

  it('forwards endUserAuth in the update payload', async () => {
    const client = new MockClient() as any
    const endUserAuth = {
      mode: 'jwt',
      jwksUrl: 'https://idp.example.com/.well-known/jwks.json',
      issuer: 'https://idp.example.com/',
      claims: { userId: 'sub', role: 'role' }
    }
    await updateAgentHandler(client, { agentId: 'a1', endUserAuth })

    expect(client.methodCalls[0].path).toBe('/api/v1/mcp/agents/a1')
    expect(client.methodCalls[0].payload.endUserAuth).toEqual(endUserAuth)
  })
})
