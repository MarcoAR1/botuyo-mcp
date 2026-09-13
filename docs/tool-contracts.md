# Tool contracts

Available in @botuyo/mcp 0.10.0 with backend 2.7.0. They require the matching backend; updating the MCP package alone does not add the new API endpoints. No tools execute business actions through this MCP: it configures conversational agents, which invoke their tools during conversations.

## Discover, configure, inspect

1. Call `get_tools_catalog`. Its `tools` array preserves complete metadata, descriptions and schemas; `text` remains available for older clients.
2. Select an existing tool or an eligible `baseTool` with `allowMultiInstance: true`. A virtual instance gives an existing implementation a new name; it does not create executable code.
3. Call `configure_agent_tool` with the configuration and, optionally, existing `stageIds` to associate it with the conversation flow.
4. Call `get_tool_contract` with `agentId`, `toolName` and `channel`. It returns the actual invocation schema, including configured enums, and whether the tool is available. It also works for drafts. Authentication and other runtime permissions still apply.

```json
{
  "agentId": "YOUR_AGENT_ID",
  "toolName": "navigate_to",
  "mode": "patch",
  "stageIds": ["discovery"],
  "instruction": "Navigate only when the visitor requests it or explicitly accepts an offer. Never navigate during the greeting.",
  "params": {
    "destinations": [
      { "id": "pricing", "label": "Pricing", "path": "#precios", "description": "Open the published pricing section" }
    ]
  }
}
```

The stage must already exist, and the anchor must exist in the host website. Inspect the result with:

```json
{ "agentId": "YOUR_AGENT_ID", "toolName": "navigate_to", "channel": "web" }
```

The conversational agent then invokes `navigate_to({"destination":"pricing"})`. It does not supply the path or the destinations array. The backend resolves the path from trusted agent configuration. Chat and web voice use the same resolved declaration.

## Three separate schemas

| Field | Meaning |
|---|---|
| `contractVersion` | Contract format version, currently `1.0`; independent of the npm version |
| `configurationSchema` | The persisted envelope: `params`, typed `fields`, `instruction`, optional `baseTool` and `connector` |
| `invocationSchema` | Arguments accepted from the conversational model; the catalog contains the base form, `get_tool_contract` contains the resolved form |
| `resultSchema` | Declared runtime result schema; `{}` means a legacy tool has not declared its result shape |
| `resultSchemaDefined` | Whether a specific runtime result schema is declared; do not interpret legacy `{}` as a typed success contract |
| `configSchema` | Existing UI metadata, preserved for compatibility; structured fields can include a nested JSON `schema` |

The MCP exports standard JSON Schema types (`object`, `string`, etc.). Provider-specific uppercase types are normalized. `fields` supports string, number, boolean, date and enum, with required flags and validation limits. Configured fixed parameters are hidden from invocation schemas and take precedence over model arguments. They are configuration, not suggestions.

Known configuration fields are validated on the backend before saving and before execution. Extension parameters remain accepted where legacy tools have incomplete configuration metadata. Use the published schema and documented extensions; unknown keys do not acquire behavior just because they can be stored.

## Safe updates

- `mode: "replace"` is the default for compatibility. It replaces the entire tool entry. Omitted params, fields and instruction are removed.
- `mode: "patch"` preserves omitted properties and merges `params` by top-level key. A supplied `fields` array replaces the existing array. To remove an individual param, use `replace` with the desired full entry.
- `get_tool_config` now returns the actual `fields`, connector and `updatedAt`, as well as existing metadata. Pass that timestamp as `expectedUpdatedAt` when editing a previously read configuration.
- A stale timestamp or a competing write during `configure_agent_tool` returns HTTP 409. Read again and reconcile changes before retrying. Do not blindly replay a replacement.
- The dedicated configuration write uses an atomic comparison in MongoDB and preserves unrelated tools. This is not a multi-document transaction covering an entire family. Family-member edits still synchronize their authoring source using the existing family service.

`enabledTools` is the whitelist. Runtime resolution also applies integration status, channel compatibility and the union of tools in channel-visible stages. Adding to `enabledTools` alone does not guarantee availability. Aliases inherit the base tool's channel and integration restrictions. `get_tool_contract` exposes `available`, `unavailableReason`, the base schema and the effective schema; the effective schema is null when no declaration survives resolution.

## Families

`base` and variant `overrides` expose nested authoring schemas, including `toolConfigs`. Tool field schemas are shared with the backend. `update_family_base` replaces the shared base and materializes variants; preserve the full base when using it. It is different from patching one tool entry. Invalid effective configurations of known tools are rejected before family materialization.

## Results and navigation receipts

MCP results now include `structuredContent` for object results while retaining serialized JSON in text. Tools with `outputSchema` validate successful results against it. Business failures (`success: false`, `status: "error"`, or an error value) produce `isError: true`. Client events are suppressed for failed runtime tool responses.

Configured navigation emits `navigation_requested` with a server-created `requestId` and a resolved local path. The widget validates the request, scrolls a real anchor, and reports `completed`, `failed` or `delegated`. A router callback or full-page request without observed completion is `delegated`, not `completed`. The backend accepts a receipt only for the originating tenant and device, once, within 60 seconds. Receipt state is transient and bounded; restart or expiry does not imply success. The original tool result remains `navigationStatus: "requested"`, and client receipts are advisory rather than independent proof of browser state.

Navigation requires an explicit `params.destinations` catalog. Global routes and the legacy `{section, params}` invocation have been removed. `baseUrl` and `allowedRoutes` are rejected as unknown configuration keys. A missing catalog never emits a navigation action. Migrate saved agents and family bases before adopting the new backend.

## API and schema maintenance

All endpoints use the existing authenticated `/api/v1/mcp` namespace:

- `GET /tools/catalog`
- `GET /agents/{agentId}/tool-configs`
- `GET /agents/{agentId}/tool-contracts/{toolName}?channel=web`
- `PUT /agents/{agentId}/tool-config/{toolName}` — owner, admin or developer

The canonical configuration schemas live in the backend at `src/shared/contracts/ToolConfigSchema.ts`. With sibling checkouts, run `node scripts/sync-tool-schemas.mjs` after editing that source, then `node scripts/sync-tool-schemas.mjs --check`. The MCP package includes the generated copy and runs without a backend checkout.

See the [MCP tool specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) for the distinction between input schemas, output schemas and structured results.
