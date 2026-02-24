import { describe, it, expect } from 'bun:test'
import type { PromptMetadata, ParsedDotprompt } from '../types'

describe('PromptMetadata', () => {
  it('accepts a fully-populated metadata object', () => {
    const meta: PromptMetadata = {
      model: 'anthropic/claude-sonnet-4-20250514',
      config: { temperature: 0.9, maxOutputTokens: 2048 },
      input: {
        default: { language: 'python' },
        schema: { code: 'string', language: 'string' },
      },
      output: {
        format: 'json',
        schema: { summary: 'string' },
      },
      tools: ['search', 'fetch'],
      description: 'Analyzes code',
      ext: { myapp: { version: 2 } },
    }

    expect(meta.model).toBe('anthropic/claude-sonnet-4-20250514')
    expect(meta.tools).toEqual(['search', 'fetch'])
    expect(meta.ext?.myapp).toEqual({ version: 2 })
  })

  it('accepts an empty metadata object', () => {
    const meta: PromptMetadata = {}
    expect(meta).toEqual({})
  })
})

describe('ParsedDotprompt', () => {
  it('holds source, metadata, and template', () => {
    const parsed: ParsedDotprompt = {
      source: '---\nmodel: test\n---\nHello',
      metadata: { model: 'test' },
      template: 'Hello',
    }

    expect(parsed.source).toBe('---\nmodel: test\n---\nHello')
    expect(parsed.metadata.model).toBe('test')
    expect(parsed.template).toBe('Hello')
  })
})
