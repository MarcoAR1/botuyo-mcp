# P1 — High

## MCP-P1-1 — `verify()` and `uploadMedia()` bypass retry + HTML-block handling

- **Category:** inconsistency / resilience bug
- **Location:** `src/client.ts`
  - `verify()` (line ~57) uses a **raw `fetch()`** + `parseJson()`
  - `uploadMedia()` (line ~193) uses a **raw `fetch()`** + `parseJson()`
  - `get/post/put/delete` correctly use `fetchWithRetry()` + `handleResponse()`
- **Problem:** `verify()` is the **first** network call on server start (`index.ts` → `client.verify()`), so it's the most likely to hit a transient Netskope **403 HTML block** or network blip — exactly the failure observed in the field ("first run blocked while a later call on the same prefix succeeded"). But `verify()` has **no retry** and **no `looksLikeHtml` detection**, so a transient block makes startup auth fail with a confusing error and the tools fall back to "re-authenticate" even though the token is valid. `uploadMedia()` has the same gap (no retry on multipart upload).
- **Fix:**
  1. Route `verify()` through `fetchWithRetry` (it's idempotent → safe to retry).
  2. Use the unified parser (see MCP-P2-1) so `verify()`/`uploadMedia()` also get the HTML-block message.
  3. Consider `uploadMedia` retry (idempotency caveat: only retry on network error/5xx before the body is consumed).
- **Confidence:** High — confirmed in `client.ts`. **Effort:** S. Add a `.spec.ts` simulating a 403 HTML body then a success (assert one retry).
