import { Ajv } from 'ajv'
import addFormats from 'ajv-formats'
import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js'

const ajv = new Ajv({ allErrors: true, strict: false, coerceTypes: false, useDefaults: false, removeAdditional: false })
addFormats.default(ajv)

export function assertToolInput(tool: Tool, args: unknown): void {
  const validate = ajv.compile(tool.inputSchema)
  if (!validate(args)) throw new Error(`Invalid arguments for ${tool.name}: ${ajv.errorsText(validate.errors)}`)
}

export function formatToolResult(tool: Tool, result: unknown): CallToolResult {
  const object = result && typeof result === 'object' && !Array.isArray(result) ? result as Record<string, unknown> : undefined
  const isError = object?.success === false || object?.status === 'error' || !!object?.error
  if (!isError && tool.outputSchema) {
    const validate = ajv.compile(tool.outputSchema)
    if (!validate(object)) throw new Error(`Invalid result for ${tool.name}: ${ajv.errorsText(validate.errors)}`)
  }
  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) ?? 'null' }],
    ...(object ? { structuredContent: object } : {}),
    ...(isError ? { isError: true } : {})
  }
}
