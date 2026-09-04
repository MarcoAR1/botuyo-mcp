import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the filesystem so the handler doesn't touch a real file.
vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
  statSync: vi.fn(() => ({ size: 1024 })),
  readFileSync: vi.fn(() => Buffer.from('fake-image-bytes'))
}))

import { uploadAgentMediaHandler } from '../upload_agent_media.js'
import { existsSync, statSync } from 'fs'

class MockClient {
  public putCalls: Array<{ path: string; payload: any }> = []
  public uploadArgs: { fileName: string; category: string } | null = null
  async uploadMedia(_buf: Buffer, fileName: string, category: string) {
    this.uploadArgs = { fileName, category }
    return 'https://cdn.botuyo.com/agents/uploaded.png'
  }
  async put(path: string, payload: any) {
    this.putCalls.push({ path, payload })
    return { success: true }
  }
}

describe('uploadAgentMediaHandler', () => {
  beforeEach(() => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(statSync).mockReturnValue({ size: 1024 } as any)
  })

  it('uploads an avatar and patches widgetConfig.avatarUrl', async () => {
    const client = new MockClient()
    const result: any = await uploadAgentMediaHandler(client as any, {
      agentId: 'a1',
      filePath: '/tmp/pic.png'
    })

    expect(client.uploadArgs).toEqual({ fileName: 'pic.png', category: 'avatar' })
    expect(client.putCalls[0].path).toBe('/api/v1/mcp/agents/a1')
    expect(client.putCalls[0].payload.widgetConfig.avatarUrl).toBe('https://cdn.botuyo.com/agents/uploaded.png')
    expect(result.data.assignedTo).toBe('widgetConfig.avatarUrl')
  })

  it('uploads a logo and patches widgetConfig.logoUrl', async () => {
    const client = new MockClient()
    await uploadAgentMediaHandler(client as any, {
      agentId: 'a1',
      filePath: '/tmp/logo.webp',
      mediaType: 'logo'
    })

    expect(client.uploadArgs).toEqual({ fileName: 'logo.webp', category: 'logo' })
    expect(client.putCalls[0].payload.widgetConfig.logoUrl).toBe('https://cdn.botuyo.com/agents/uploaded.png')
  })

  it('throws when required args are missing', async () => {
    const client = new MockClient()
    await expect(uploadAgentMediaHandler(client as any, { agentId: 'a1' })).rejects.toThrow()
    await expect(uploadAgentMediaHandler(client as any, { filePath: '/tmp/pic.png' })).rejects.toThrow()
  })

  it('throws when the file does not exist', async () => {
    vi.mocked(existsSync).mockReturnValueOnce(false)
    const client = new MockClient()
    await expect(
      uploadAgentMediaHandler(client as any, { agentId: 'a1', filePath: '/tmp/missing.png' })
    ).rejects.toThrow(/no encontrado/i)
  })

  it('rejects unsupported extensions', async () => {
    const client = new MockClient()
    await expect(
      uploadAgentMediaHandler(client as any, { agentId: 'a1', filePath: '/tmp/pic.gif' })
    ).rejects.toThrow(/Formato no soportado/i)
  })

  it('rejects files over the 2MB limit', async () => {
    vi.mocked(statSync).mockReturnValueOnce({ size: 3 * 1024 * 1024 } as any)
    const client = new MockClient()
    await expect(
      uploadAgentMediaHandler(client as any, { agentId: 'a1', filePath: '/tmp/big.png' })
    ).rejects.toThrow(/2MB/i)
  })
})
