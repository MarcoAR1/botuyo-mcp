import { describe, it, expect } from 'vitest'
import { shortId, voiceProfileHelp } from '../format.js'

describe('shortId', () => {
  it('shortens a 24-char Mongo ObjectId to first8…last4', () => {
    expect(shortId('6988e1877a3c2a943468b9e2')).toBe('6988e187…b9e2')
  })

  it('returns short strings unchanged', () => {
    expect(shortId('abc')).toBe('abc')
    expect(shortId('owner')).toBe('owner')
    expect(shortId('123456789012')).toBe('123456789012')
  })

  it('handles empty and undefined gracefully', () => {
    expect(shortId('')).toBe('')
    expect(shortId(undefined as unknown as string)).toBe('')
  })
})

describe('voiceProfileHelp', () => {
  it('lists all 8 voice profiles (incl. orus/zephyr, previously missing in update_agent)', () => {
    const help = voiceProfileHelp()
    for (const id of ['kore', 'aoede', 'leda', 'puck', 'charon', 'fenrir', 'orus', 'zephyr']) {
      expect(help).toContain(`(${id})`)
    }
  })

  it('formats each entry as "DisplayName" (id)', () => {
    expect(voiceProfileHelp()).toContain('"Profesional Femenina" (kore)')
    expect(voiceProfileHelp()).toContain('"Suave Neutral" (zephyr)')
  })
})
