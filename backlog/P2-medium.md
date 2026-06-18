# P2 — Medium

## MCP-P2-1 — `handleResponse` and `parseJson` are near-duplicate parsers (and diverge)

- **Category:** duplication / inconsistency
- **Location:** `src/client.ts` — `handleResponse` (line ~159) and `parseJson` (line ~210)
- **Problem:** Both read `res.text()`, `JSON.parse`, and throw `ApiError` on `!ok`. But they **diverge**: only `handleResponse` has the `looksLikeHtml` proxy/firewall detection; `parseJson` (used by `verify`/`uploadMedia`) does not. Two parsers means future fixes land in one and not the other (the divergence already happened).
- **Fix:** Collapse into a single private `parse(res)` that includes the HTML-block heuristic and the `!ok` handling; have `get/post/put/delete/verify/uploadMedia` all use it. Keep `ApiError(status)` semantics.
- **Confidence:** High. **Effort:** S. (RULE 4: "never change `handleResponse`/`parseJson` without testing ALL tools" → run the full tool spec suite after.)

## MCP-P2-2 — `~/.botuyo/netskope-ca.pem` not auto-detected as HTTPS CA

- **Category:** DX / optimization
- **Location:** `src/client.ts` (no CA / `https.Agent` / `NODE_EXTRA_CA_CERTS` wiring)
- **Problem:** Behind the corporate proxy, TLS only works if the user manually exports `NODE_EXTRA_CA_CERTS=$HOME/.botuyo/netskope-ca.pem`. Nothing in the client detects or wires this, so first-time users hit opaque TLS errors.
- **Fix:** On startup, if `~/.botuyo/netskope-ca.pem` exists and `NODE_EXTRA_CA_CERTS` is unset, construct an `https.Agent({ ca })` and pass it to `fetch` (undici `dispatcher`), or document the env var prominently in the auth command output. Keep it opt-in/no-op when the file is absent.
- **Confidence:** Med — **(verify)** current fetch has no dispatcher/agent. **Effort:** M (undici Agent wiring + test).
