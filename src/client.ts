/**
 * BotuyoApiClient - Thin HTTP wrapper around the BotUyo REST API
 * All MCP tools go through this client.
 *
 * Uses a JWT token directly (obtained via `npx @botuyo/mcp auth` or `npx @botuyo/mcp login`).
 * Requires Node 18+ (native fetch).
 */

export class ApiError extends Error {
  public readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export interface BotuyoClientConfig {
  apiUrl: string
  token: string
  /** Optional retry/backoff tuning for transient failures (network errors + 5xx). Defaults: 2 retries, 300ms base. */
  retry?: { retries?: number; baseDelayMs?: number }
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
  private activeTenantId: string | null = null // Track tenant set by switch_tenant

  constructor(config: BotuyoClientConfig) {
    this.config = config
  }

  /** Get the current JWT token */
  getToken(): string {
    return this.config.token
  }

  /** Hot-swap the JWT token (used by switch_tenant) */
  setToken(token: string, tenantId?: string) {
    this.config = { ...this.config, token }
    this.authInfo = null // reset cached auth info
    if (tenantId) this.activeTenantId = tenantId
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
    // Use activeTenantId (from switch_tenant) if set, otherwise fall back to first tenant
    const resolvedTenantId = this.activeTenantId || user.tenantIds?.[0] || ''
    this.authInfo = {
      tenantId: resolvedTenantId,
      tenantName: '', // Will be enriched from credentials
      role: user.roles?.find((r: any) => r.tenantId === resolvedTenantId)?.role || user.roles?.[0]?.role || 'member',
      email: user.email
    }

    return this.authInfo
  }

  /** Make an authenticated GET request */
  async get<T = any>(path: string): Promise<T> {
    const res = await this.fetchWithRetry(`${this.config.apiUrl}${path}`, {
      headers: { Authorization: `Bearer ${this.config.token}` }
    })
    return this.handleResponse(res)
  }

  /** Make an authenticated POST request */
  async post<T = any>(path: string, data: unknown): Promise<T> {
    const res = await this.fetchWithRetry(`${this.config.apiUrl}${path}`, {
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
    const res = await this.fetchWithRetry(`${this.config.apiUrl}${path}`, {
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
    const res = await this.fetchWithRetry(`${this.config.apiUrl}${path}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.config.token}`
      }
    })
    return this.handleResponse(res)
  }

  private async sleep(ms: number): Promise<void> {
    if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * fetch wrapper with bounded exponential backoff.
   * Retries on thrown network errors and 5xx responses; never retries 4xx.
   */
  private async fetchWithRetry(url: string, init?: RequestInit): Promise<Response> {
    const retries = this.config.retry?.retries ?? 2
    const baseDelayMs = this.config.retry?.baseDelayMs ?? 300
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await fetch(url, init)
        if (res.status >= 500 && attempt < retries) {
          await this.sleep(baseDelayMs * 2 ** attempt)
          continue
        }
        return res
      } catch (error: unknown) {
        if (attempt < retries) {
          await this.sleep(baseDelayMs * 2 ** attempt)
          continue
        }
        const detail = error instanceof Error ? error.message : String(error)
        throw new ApiError(`Network error after ${retries + 1} attempt(s): ${detail}`, 0)
      }
    }
  }

  /** Heuristic: the body is an HTML document (e.g. a proxy/firewall block page), not an API response. */
  private looksLikeHtml(text: string): boolean {
    return /^\s*<(?:!doctype\s+html|html|head|body)\b/i.test(text)
  }

  private async handleResponse(res: Response): Promise<any> {
    const text = await res.text()
    let json: any
    try {
      json = JSON.parse(text)
    } catch {
      if (this.looksLikeHtml(text)) {
        throw new ApiError(
          `Request blocked or returned non-JSON (possible network proxy/firewall). HTTP ${res.status}: ${text.slice(0, 120)}`,
          res.status
        )
      }
      throw new ApiError(`HTTP ${res.status}: ${text.slice(0, 200)}`, res.status)
    }

    if (!res.ok) {
      const msg = json.error || `HTTP ${res.status}`
      throw new ApiError(msg, res.status)
    }

    return json
  }

  /** Upload a file via multipart POST to the media API */
  async uploadMedia(fileBuffer: Buffer, fileName: string, category: string): Promise<string> {
    // Auto-inject tenantId from JWT so callers don't need to provide it explicitly
    const auth = await this.verify()

    const blob = new Blob([new Uint8Array(fileBuffer)])
    const formData = new FormData()
    formData.append('file', blob, fileName)
    formData.append('category', category)
    formData.append('tenantId', auth.tenantId)

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
        throw new ApiError(json.error || `HTTP ${res.status}`, res.status)
      }
      return json
    } catch (e) {
      if (e instanceof ApiError) throw e
      throw new ApiError(`HTTP ${res.status}: ${text.slice(0, 200)}`, res.status)
    }
  }
}
