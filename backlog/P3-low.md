# P3 — Low / cleanup

## MCP-P3-1 — `any` defaults weaken the public client types

- **Category:** typing / tech debt
- **Location:** `src/client.ts` — `get<T = any>`, `post<T = any>`, etc.; `role: user.roles?.find((r: any) => …)`; `json: any` in parsers.
- **Problem:** RULE 10 mandates strict typing. `T = any` defaults mean every tool handler receives `any` from the client (no compile-time shape checking on responses). `r: any` skips typing the JWT roles array.
- **Fix:** Default generics to `unknown` (force tools to assert), or introduce a minimal `ApiEnvelope<T> = { success: boolean; data?: T; error?: string }`. Type the `roles` array (`{ tenantId: string; role: string }[]`).
- **Confidence:** High. **Effort:** M (ripples into tool handlers + specs).

## MCP-P3-2 — `verify()` returns a permanently-empty `tenantName`

- **Category:** dead field / inconsistency
- **Location:** `src/client.ts:71` — `tenantName: ''  // Will be enriched from credentials`
- **Problem:** `AuthInfo.tenantName` from `verify()` is always `''`; the real name is read from `~/.botuyo/credentials.json` by callers. The field is misleading dead data on the verify path.
- **Fix:** Either drop `tenantName` from the `verify()` result (callers already read creds), or have `verify()` resolve it via `GET /api/tenant/:id` (the singular tenant-name endpoint). Prefer dropping it to keep `client.ts` a pure HTTP layer (RULE 4).
- **Confidence:** High. **Effort:** XS.

## MCP-P3-3 — `get_agent` returns raw body, no name-first summary

- **Category:** UX / docs
- **Location:** `src/tools/get_agent.ts` (and the agent tools that return raw `agentConfig`)
- **Problem:** `list_agents` surfaces a readable `text` summary, but `get_agent` returns the raw API body, and the nesting (`identity`/`enabledTools`/`stages`/`voice` live **under `agentConfig`**, not top-level) is undocumented in the tool description — easy for an AI caller to mis-navigate.
- **Fix:** Add a short name-first `text` summary (reuse `format.shortId`) and document the `agentConfig` nesting in the tool description.
- **Verified 2026-07:** `get_agent.ts:18` returns `client.get(...)` raw (no `text`, no `shortId`), whereas `list_agents.ts:15-22` builds a name-first `text` via `shortId` — the asymmetry is real. The `get_agent` description (line 6) also never states the fields live under `agentConfig`.
- **Confidence:** High (confirmed in source). **Effort:** S.
