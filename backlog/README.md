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

## Method & confidence

Read `client.ts`, `format.ts`, the architecture skill. High-signal, not exhaustive. Items marked **(verify)** need a quick check. TDD (RULE 8): every fix needs/updates a `.spec.ts`. CHANGELOG rule applies on version bump.
