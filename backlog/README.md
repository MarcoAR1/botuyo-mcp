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
| P1 | 0 | (none open) |
| P2 | 0 | (none open) |
| P3 | 3 | `any` defaults; dead `tenantName` from `verify()`; `get_agent` lacks a name-first summary |

> **Removed 2026-07:** the Netskope-block cluster (former MCP-P1-1 retry/HTML-block, MCP-P2-1 parser dedup, MCP-P2-2 CA auto-detect) was dropped — those addressed a local corporate-proxy environment, not a product-facing issue.

## Method & confidence

Read `client.ts`, `format.ts`, the architecture skill. High-signal, not exhaustive. Items marked **(verify)** need a quick check. TDD (RULE 8): every fix needs/updates a `.spec.ts`. CHANGELOG rule applies on version bump.
