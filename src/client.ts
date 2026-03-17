/**
 * BotuyoApiClient - Thin HTTP wrapper around the BotUyo REST API
 * All MCP tools go through this client.
 */

import fetch, { Response } from 'node-fetch'

export interface BotuyoClientConfig {
  apiUrl: string
  apiKey: string
}

export interface AuthResult {
  token: string
  tenantId: string
  tenantName: string
  role: string
  canWrite: boolean
  channels: Array<{ type: string; status: string }>
  adminPanelUrl: string
}

export class BotuyoApiClient {
  private config: BotuyoClientConfig
  private token: string | null = null
  private authResult: AuthResult | null = null
  private tokenExpiresAt: number = 0

  constructor(config: BotuyoClientConfig) {
    this.config = config
  }

  /** Exchange API key for a JWT and cache it for 55 minutes */
  async authenticate(): Promise<AuthResult> {
    const now = Date.now()
    if (this.token && this.authResult && now < this.tokenExpiresAt) {
      return this.authResult
    }

    const res = await fetch(`${this.config.apiUrl}/api/v1/mcp/auth`, {
      method: 'POST',
      headers: {
        'x-api-key': this.config.apiKey,
        'Content-Type': 'application/json'
      }
    })

    const body = await this.parseJson(res)
    if (!body.success) {
      throw new Error(`Authentication failed: ${body.error || 'Unknown error'}`)
    }

    this.token = body.data.token
    this.authResult = body.data as AuthResult
    this.tokenExpiresAt = now + 55 * 60 * 1000 // 55 min (token expires in 1h)

    return this.authResult
  }

  /** Make an authenticated GET request */
  async get<T = any>(path: string): Promise<T> {
    await this.authenticate()
    const res = await fetch(`${this.config.apiUrl}${path}`, {
      headers: { Authorization: `Bearer ${this.token!}` }
    })
    return this.parseJson(res)
  }

  /** Make an authenticated POST request */
  async post<T = any>(path: string, data: unknown): Promise<T> {
    await this.authenticate()
    const res = await fetch(`${this.config.apiUrl}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token!}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })
    return this.parseJson(res)
  }

  /** Make an authenticated PUT request */
  async put<T = any>(path: string, data: unknown): Promise<T> {
    await this.authenticate()
    const res = await fetch(`${this.config.apiUrl}${path}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${this.token!}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })
    return this.parseJson(res)
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
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
    }
  }
}
