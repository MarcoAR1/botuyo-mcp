import { it, expect, vi } from 'vitest'
import { getToolContractHandler } from '../get_tool_contract.js'

it('requests the effective contract with encoded names and the selected channel', async () => {
  const client = { get: vi.fn(async () => ({ success: true, data: {} })) }
  await getToolContractHandler(client as any, { agentId: 'a/b', toolName: 'navigation', channel: 'web' })
  expect(client.get).toHaveBeenCalledWith('/api/v1/mcp/agents/a%2Fb/tool-contracts/navigation?channel=web')
})
