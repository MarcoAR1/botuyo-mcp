# botuyo-mcp — Code Audit Backlog

Audit of the MCP server / CLI (`@botuyo/mcp`). Generated Jun 2026.

## Priority legend

| Pri | Meaning |
|-----|---------|
| **P0** | Critical — security / data loss / outage |
| **P1** | High — real bug / breaks a documented rule |
| **P2** | Medium — tech debt, inconsistency, duplication |
| **P3** | Low — cleanup, typing, UX |

## Files

- [`P1-high.md`](./P1-high.md)
- [`P2-medium.md`](./P2-medium.md)
- [`P3-low.md`](./P3-low.md)

(No P0: the MCP client holds no auth surface of its own — authorization is enforced server-side under `/api/v1/mcp/`.)

## Summary

| Pri | Count | Headline |
|-----|-------|----------|
| P1 | 1 | `verify()` + `uploadMedia()` skip retry/HTML-block handling (the startup path that fails under Netskope) |
| P2 | 2 | `handleResponse` vs `parseJson` duplication; no auto-detect of `netskope-ca.pem` |
| P3 | 3 | `any` defaults; dead `tenantName` from `verify()`; `get_agent` lacks a name-first summary |

## Already done (NOT findings — verified in code)

- `client.ts` **has** `fetchWithRetry` (bounded exponential backoff; retries network errors + 5xx, never 4xx) on `get/post/put/delete`.
- `client.ts` **has** `looksLikeHtml` → concise "blocked by proxy/firewall" error in `handleResponse`.
- Voice/model tool docs are generated from `@botuyo/contracts` (`format.voiceProfileHelp`) — no drift.

> Older notes that said "add retry / detect HTML block" are **stale** — those landed already. The remaining gap is that two methods don't use them (see P1).

## Method & confidence

Read `client.ts`, `format.ts`, the architecture skill. High-signal, not exhaustive. Items marked **(verify)** need a quick check. TDD (RULE 8): every fix needs/updates a `.spec.ts`. CHANGELOG rule applies on version bump.
