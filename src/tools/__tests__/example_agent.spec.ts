import { describe, it, expect } from 'vitest'
import { exampleAgentHandler } from '../example_agent.js'

describe('exampleAgentHandler', () => {
  it('should return a static agent configuration object', async () => {
    const res = await exampleAgentHandler() as any
    expect(res.success).toBe(true)
    expect(res.data.name).toBe('Mi Agente de Ejemplo')
    expect(res.data.stages).toBeInstanceOf(Array)
    expect(res.data.connections).toBeInstanceOf(Array)
  })

  it('documents endUserAuth (authenticated end-user config)', async () => {
    const res = await exampleAgentHandler() as any
    expect(res.data.endUserAuth).toBeDefined()
    expect(res.data.endUserAuth.mode).toBe('jwt')
    expect(res.data.endUserAuth.claims.userId).toBeDefined()
    expect(typeof res.data._endUserAuth_doc).toBe('string')
    // the doc must cover both verification modes
    expect(res.data._endUserAuth_doc).toContain('callback')
  })
})
