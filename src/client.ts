/**
 * BotuyoApiClient - Thin HTTP wrapper around the BotUyo REST API
 * All MCP tools go through this client.
 *
 * Uses a JWT token directly (obtained via `npx @botuyo/mcp auth` or `npx @botuyo/mcp login`).
 * Requires Node 18+ (native fetch).
 */

export interface BotuyoClientConfig {
  apiUrl: string
  token: string
}

export interface AuthInfo {
  tenantId: string
  tenantName: string
  role: string
  email: string
}

export class BotuyoApiClient {
  private config: BotuyoClientConfig
  private authInfo: AuthInfo | null = null

  constructor(config: BotuyoClientConfig) {
    this.config = config
  }

  /** Get the current JWT token */
  getToken(): string {
    return this.config.token
  }

  /** Hot-swap the JWT token (used by switch_tenant) */
  setToken(token: string) {
    this.config = { ...this.config, token }
    this.authInfo = null // reset cached auth info
  }

  /** Verify the stored JWT is still valid by calling GET /api/auth/me */
  async verify(): Promise<AuthInfo> {
    if (this.authInfo) return this.authInfo

    const res = await fetch(`${this.config.apiUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${this.config.token}` }
    })

    const body = await this.parseJson(res)
    if (!body.success) {
      throw new Error(`Session expired or invalid: ${body.error || 'Unknown error'}. Run: npx @botuyo/mcp auth (browser) or npx @botuyo/mcp login (terminal)`)
    }

    const user = body.data.user
    this.authInfo = {
      tenantId: user.tenantIds?.[0] || '',
      tenantName: '', // Will be enriched from credentials
      role: user.roles?.[0]?.role || 'member',
      email: user.email
    }

    return this.authInfo
  }

  /** Make an authenticated GET request */
  async get<T = any>(path: string): Promise<T> {
    const res = await fetch(`${this.config.apiUrl}${path}`, {
      headers: { Authorization: `Bearer ${this.config.token}` }
    })
    return this.handleResponse(res)
  }

  /** Make an authenticated POST request */
  async post<T = any>(path: string, data: unknown): Promise<T> {
    const res = await fetch(`${this.config.apiUrl}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })
    return this.handleResponse(res)
  }

  /** Make an authenticated PUT request */
  async put<T = any>(path: string, data: unknown): Promise<T> {
    const res = await fetch(`${this.config.apiUrl}${path}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })
    return this.handleResponse(res)
  }

  /** Make an authenticated DELETE request */
  async delete<T = any>(path: string): Promise<T> {
    const res = await fetch(`${this.config.apiUrl}${path}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.config.token}`
      }
    })
    return this.handleResponse(res)
  }

  private async handleResponse(res: Response): Promise<any> {
    const json = await this.parseJson(res)

    // Detect expired token
    if (res.status === 401) {
      throw new Error('Sesión expirada. Ejecutá: npx @botuyo/mcp auth (browser) o npx @botuyo/mcp login (terminal)')
    }

    return json
  }

  /** Upload a file via multipart POST to the media API */
  async uploadMedia(fileBuffer: Buffer, fileName: string, category: string): Promise<string> {
    const blob = new Blob([new Uint8Array(fileBuffer)])
    const formData = new FormData()
    formData.append('file', blob, fileName)
    formData.append('category', category)

    const res = await fetch(`${this.config.apiUrl}/api/media/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.token}`
        // Note: no Content-Type header — fetch sets multipart boundary automatically
      },
      body: formData
    })

    const json = await this.parseJson(res)
    if (!json.success && !json.url) {
      throw new Error(`Upload failed: ${json.error || 'Unknown error'}`)
    }

    return json.url || json.data?.url
  }

  private async parseJson(res: Response): Promise<any> {
    const text = await res.text()
    try {
      const json = JSON.parse(text)
      if (!res.ok && !json.success) {
        throw new Error(json.error || `HTTP ${res.status}`)
      }
      return json
    } catch (e) {
      if (e instanceof Error && e.message.includes('HTTP')) throw e
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
    }
  }
}
