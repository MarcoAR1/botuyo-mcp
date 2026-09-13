/** The update API uses null as a deletion marker, including nested object properties. */
export function nullableUpdate(schema: Record<string, unknown>): Record<string, unknown> {
  const result = structuredClone(schema)
  if (typeof result.type === 'string') result.type = [result.type, 'null']
  if (Array.isArray(result.enum)) result.enum = [...result.enum, null]
  if (result.properties) result.properties = Object.fromEntries(Object.entries(result.properties as Record<string, Record<string, unknown>>).map(([key, value]) => [key, nullableUpdate(value)]))
  return result
}
