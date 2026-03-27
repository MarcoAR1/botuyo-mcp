---
name: BotUyo MCP Architecture and Testing Rules
description: Comprehensive architecture, structure, conventions, tool patterns, and hard rules for the botuyo-mcp project. Read this BEFORE making any changes.
---

# BotUyo MCP Server — Hard Rules & Architecture

> **READ THIS ENTIRE FILE before making changes to the codebase.** These are immutable rules that MUST be followed.

**Core stack:** TypeScript (strict) · Node.js (native fetch) · @modelcontextprotocol/sdk · Zod · Vitest
**Module system:** ESM (`"type": "module"`) — all import paths MUST use `.js` extension
**Published as:** `@botuyo/mcp` on npm

---

## RULE 1: Project Architecture

```
src/
├── index.ts          # Entry point: CLI sub-command router + MCP server startup
├── client.ts         # BotuyoApiClient — thin HTTP wrapper (GET/POST/PUT/DELETE)
├── tools/            # MCP tool definitions + handlers (one file per tool)
│   ├── index.ts      # Registry: ALL_TOOLS[] + TOOL_HANDLERS{}
│   ├── {tool}.ts     # Each tool: definition const + handler function
│   └── __tests__/    # One .spec.ts per tool (MockClient pattern)
└── commands/         # CLI sub-commands (login, auth, tenants, setup, etc.)
```

**Hard rules:**
- `src/tools/` = MCP tools (exposed to AI assistants)
- `src/commands/` = CLI commands (exposed to human users)
- `dist/` = compiled output — NEVER edit manually

## RULE 2: Tool File Pattern (CRITICAL)

Every MCP tool follows the **exact same structure** — a Tool definition + a handler function:

```typescript
import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { BotuyoApiClient } from '../client.js'

export const MY_TOOL: Tool = {
  name: 'my_tool',
  description: 'What this tool does. Include role requirements.',
  inputSchema: { type: 'object', properties: { ... }, required: [...] }
}

export async function myToolHandler(
  client: BotuyoApiClient, args: Record<string, unknown>
): Promise<unknown> {
  return client.get(`/api/v1/mcp/...`)
}
```

**Hard rules:**
- **Export naming:** `UPPER_SNAKE_TOOL` for definition, `camelCaseHandler` for function
- **Handler signature:** `(client: BotuyoApiClient, args: Record<string, unknown>) => Promise<unknown>`
- **All API calls go through `client.*`** — NEVER use `fetch()` directly in tools
- **Import paths MUST use `.js` extension** — ESM requires it

## RULE 3: Tool Registration

After creating a tool file, you MUST register it in `src/tools/index.ts`:

1. Import definition + handler
2. Add definition to `ALL_TOOLS[]`
3. Add handler to `TOOL_HANDLERS{}` — key **MUST match** `Tool.name` exactly

**If you forget this step, the tool is invisible to MCP.**

## RULE 4: BotuyoApiClient Architecture

The client is a **pure HTTP wrapper** — all tools go through it:

- `client.get/post/put/delete` — authenticated HTTP methods
- `client.verify()` — validate JWT
- `client.setToken()` — hot-swap JWT (used by switch_tenant)

**Hard rules:**
- **Auth header** `Authorization: Bearer ${token}` added automatically
- **401 responses** throw expiration error — caught by index.ts MCP handler
- **NEVER add business logic to client.ts** — it's a pure HTTP layer
- **NEVER change `handleResponse`/`parseJson`** without testing ALL tools

## RULE 5: CLI vs MCP Server Separation

The entry point routes CLI sub-commands BEFORE starting the MCP server. The default (no command) starts the MCP stdio server.

**Hard rules:**
- **CLI commands use `console.log`/`console.error`** for user-facing output
- **MCP server uses `console.error` ONLY** — stdout is reserved for MCP protocol (using `console.log` corrupts it)
- **Credentials** stored at `~/.botuyo/credentials.json`
- **Token resolution priority:** `BOTUYO_TOKEN` env var → `~/.botuyo/credentials.json`
- **NEVER hardcode tokens or API URLs** — use `BOTUYO_API_URL` env or default

## RULE 6: Authentication Flow

```
Login → POST /api/auth/login → JWT saved to ~/.botuyo/credentials.json
Server start → resolveToken() → isTokenExpired() → client.verify() → if 401 → exit
```

**Token includes:** `{ token, tenantId, tenantName, role, email, savedAt, expiresAt }`

## RULE 7: API Path Convention

All MCP tools call the backend under the `/api/v1/mcp/` prefix. This is the dedicated MCP API namespace with proper authorization.

**NEVER call non-MCP API endpoints** — the MCP routes have the correct response format and access control.

## RULE 8: Testing & TDD (MANDATORY)

**TEST-DRIVEN DEVELOPMENT (TDD) IS MANDATORY for all changes.**

### TDD Cycle — Red → Green → Refactor
1. **🔴 Red** — Write the `.spec.ts` test FIRST. It MUST fail.
2. **🟢 Green** — Write the MINIMUM code to make it pass.
3. **🔵 Refactor** — Improve quality while keeping ALL tests green.
4. **✅ Verify** — `npm run build && npm run test` must pass with zero errors.

### Test Pattern (MockClient)
Every tool test uses a MockClient that records paths/payloads and returns mock responses:

```typescript
class MockClient {
  public paths: string[] = []
  public payloads: any[] = []
  async post(path: string, payload: any) {
    this.paths.push(path); this.payloads.push(payload)
    return { success: true, data: { id: '123', ...payload } }
  }
}
```

### Regression Prevention
- **Every new tool MUST have a `.spec.ts`** — no exceptions
- **If an existing test breaks:** false regression → update test first; real regression → fix your code
- **NEVER delete or weaken tests** without explicit user direction
- **NEVER skip tests** with `.skip` or `xit`

**No task is considered complete until build + test pass with zero errors.**

## RULE 9: Error Handling

- MCP request handler wraps all tool calls in try/catch
- **401 errors** → helpful re-auth message
- **Unknown tools** → `isError: true` with tool name
- **NEVER swallow errors** — let them propagate to the MCP handler

## RULE 10: Code Style

- **TypeScript strict mode** — `strict: true`
- **ESM imports** — always `.js` extension
- **No path aliases** — relative imports only (project is flat)
- **Error typing:** `catch (error: unknown)` → `error instanceof Error ? error.message : String(error)`
- **Minimal dependencies** — keep the npm package lean

## RULE 11: Common Pitfalls (NEVER Do These)

1. ❌ Forgetting `.js` extension in imports → ESM runtime crash
2. ❌ Using `console.log` in MCP server mode → corrupts stdio protocol
3. ❌ Adding a tool without registering in `tools/index.ts` → tool invisible
4. ❌ Using `fetch()` directly in tools → bypasses auth
5. ❌ `TOOL_HANDLERS` key not matching `Tool.name` → handler never called
6. ❌ Adding heavy dependencies → bloats npm package
7. ❌ Creating a new tool without a `.spec.ts` → violates TDD policy
8. ❌ Deleting/weakening tests → violates TDD policy

---

## Reference Files

For mutable details (specific tool list, command details, publish workflow), see:
- [conventions.md](./conventions.md) — How to add new tools, command patterns, publish workflow
