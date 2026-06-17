/**
 * Display helpers shared by CLI commands and MCP tools.
 */

import { VOICE_PROFILES } from '@botuyo/contracts'

/**
 * Shorten a long identifier (e.g. a Mongo ObjectId) for display,
 * keeping the first 8 and last 4 characters: `6988e187…b9e2`.
 * Strings of 13 chars or fewer are returned unchanged.
 */
export function shortId(id: string): string {
  if (!id) return ''
  if (id.length <= 13) return id
  return `${id.slice(0, 8)}…${id.slice(-4)}`
}

/**
 * Comma-separated `"DisplayName" (id)` list of every voice profile, for tool-schema
 * docs. Generated from the shared @botuyo/contracts catalog so MCP tool descriptions
 * never drift from the platform's actual voices.
 */
export function voiceProfileHelp(): string {
  return VOICE_PROFILES.map((p) => `"${p.displayName}" (${p.id})`).join(', ')
}
