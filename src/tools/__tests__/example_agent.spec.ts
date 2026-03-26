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
})
