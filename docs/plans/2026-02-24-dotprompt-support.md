# Dotprompt Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add dotprompt format support to the teleprompter-sdk so it correctly reflects the server-side changes on the `britt/dotprompt-support` branch, including new types (`PromptMetadata`, `ParsedDotprompt`), parser functions (`parseDotprompt`, `validateDotprompt`), and metadata on the `Prompt` type.

**Architecture:** The SDK gains a parser module (`src/parser.ts`) and types module (`src/types.ts`) that mirror the server's dotprompt support. The `Prompt` interface gains an optional `metadata` field. The `KV.render()` method strips frontmatter before rendering. The `mustache` dependency stays for template rendering; `dotprompt` and `yaml` are added for parsing/validation.

**Tech Stack:** TypeScript, Bun, dotprompt (npm), yaml (npm), Mustache (existing)

---

### Task 1: Add dotprompt and yaml dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install new dependencies**

Run: `bun add dotprompt@^1.1.2 yaml`

**Step 2: Verify installation**

Run: `bun install && ls node_modules/dotprompt node_modules/yaml`
Expected: Both directories exist

**Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "feat: add dotprompt and yaml dependencies"
```

---

### Task 2: Add PromptMetadata and ParsedDotprompt types

**Files:**
- Create: `src/types.ts`
- Test: `src/__tests__/types.test.ts`

**Step 1: Write the failing test**

Create `src/__tests__/types.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `bun test src/__tests__/types.test.ts`
Expected: FAIL — cannot resolve `../types`

**Step 3: Write the types module**

Create `src/types.ts`:

```typescript
/**
 * Metadata extracted from dotprompt YAML frontmatter.
 * Stored alongside the raw template source.
 */
export interface PromptMetadata {
  model?: string
  config?: Record<string, unknown>
  input?: {
    default?: Record<string, unknown>
    schema?: Record<string, unknown>
  }
  output?: {
    format?: string
    schema?: Record<string, unknown>
  }
  tools?: string[]
  description?: string
  ext?: Record<string, Record<string, unknown>>
}

/**
 * A parsed dotprompt: the raw source plus extracted metadata and template body.
 */
export interface ParsedDotprompt {
  source: string
  metadata: PromptMetadata
  template: string
}

/**
 * Result of validating a dotprompt source string.
 */
export interface ValidationResult {
  valid: boolean
  error?: string
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/__tests__/types.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/types.ts src/__tests__/types.test.ts
git commit -m "feat: add PromptMetadata and ParsedDotprompt types"
```

---

### Task 3: Add parseDotprompt and validateDotprompt functions

**Files:**
- Create: `src/parser.ts`
- Test: `src/__tests__/parser.test.ts`

**Step 1: Write the failing tests**

Create `src/__tests__/parser.test.ts`:

```typescript
import { describe, it, expect } from 'bun:test'
import { parseDotprompt, validateDotprompt } from '../parser'

describe('parseDotprompt', () => {
  it('parses a full dotprompt with frontmatter', () => {
    const source = [
      '---',
      'model: googleai/gemini-1.5-pro',
      'config:',
      '  temperature: 0.9',
      'input:',
      '  schema:',
      '    topic: string',
      'output:',
      '  format: json',
      '  schema:',
      '    title: string',
      '---',
      'Write about {{topic}}.',
    ].join('\n')

    const result = parseDotprompt(source)

    expect(result.source).toBe(source)
    expect(result.metadata.model).toBe('googleai/gemini-1.5-pro')
    expect(result.metadata.config).toEqual({ temperature: 0.9 })
    expect(result.metadata.input?.schema).toEqual({ topic: 'string' })
    expect(result.metadata.output?.format).toBe('json')
    expect(result.metadata.output?.schema).toEqual({ title: 'string' })
    expect(result.template).toBe('Write about {{topic}}.')
  })

  it('handles a plain template with no frontmatter (backward compat)', () => {
    const source = 'Hello {{name}}, welcome!'

    const result = parseDotprompt(source)

    expect(result.source).toBe(source)
    expect(result.metadata).toEqual({})
    expect(result.template).toBe(source)
  })

  it('parses frontmatter with only model specified', () => {
    const source = '---\nmodel: openai/gpt-4\n---\nTell me a joke.'

    const result = parseDotprompt(source)

    expect(result.metadata.model).toBe('openai/gpt-4')
    expect(result.template).toBe('Tell me a joke.')
  })

  it('preserves description and tools in metadata', () => {
    const source = [
      '---',
      'description: Summarizes articles',
      'tools:',
      '  - search',
      '  - fetch',
      '---',
      'Summarize: {{text}}',
    ].join('\n')

    const result = parseDotprompt(source)

    expect(result.metadata.description).toBe('Summarizes articles')
    expect(result.metadata.tools).toEqual(['search', 'fetch'])
  })

  it('handles empty frontmatter gracefully', () => {
    const source = '---\n---\nJust a template.'

    const result = parseDotprompt(source)

    expect(result.metadata).toEqual({})
    expect(result.template).toBe('Just a template.')
  })

  it('handles CRLF line endings in frontmatter', () => {
    const source = '---\r\nmodel: test\r\n---\r\nHello'
    const result = parseDotprompt(source)
    expect(result.metadata.model).toBe('test')
    expect(result.template).toBe('Hello')
  })

  it('handles empty frontmatter with CRLF', () => {
    const source = '---\r\n---\r\nJust a template.'
    const result = parseDotprompt(source)
    expect(result.metadata).toEqual({})
    expect(result.template).toBe('Just a template.')
  })

  it('preserves extension fields', () => {
    const source = [
      '---',
      'model: test/model',
      'ext:',
      '  myapp:',
      '    version: 2',
      '---',
      'Hello',
    ].join('\n')

    const result = parseDotprompt(source)

    expect(result.metadata.ext?.myapp).toEqual({ version: 2 })
  })
})

describe('validateDotprompt', () => {
  it('returns valid for well-formed dotprompt', () => {
    const source = '---\nmodel: test\n---\nHello {{name}}'
    const result = validateDotprompt(source)
    expect(result.valid).toBe(true)
  })

  it('returns valid for plain template (no frontmatter)', () => {
    const source = 'Hello {{name}}'
    const result = validateDotprompt(source)
    expect(result.valid).toBe(true)
  })

  it('returns error for malformed YAML frontmatter', () => {
    const source = '---\n  bad yaml:\n    - [unclosed\n---\nHello'
    const result = validateDotprompt(source)
    expect(result.valid).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('returns error for frontmatter with non-object result', () => {
    const source = '---\njust a string\n---\nHello'
    const result = validateDotprompt(source)
    expect(result.valid).toBe(false)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test src/__tests__/parser.test.ts`
Expected: FAIL — cannot resolve `../parser`

**Step 3: Write the parser module**

Create `src/parser.ts`:

```typescript
import { Dotprompt } from 'dotprompt'
import YAML from 'yaml'
import type { ParsedDotprompt, PromptMetadata, ValidationResult } from './types'

const dp = new Dotprompt()

/** Regex to detect frontmatter: opening ---, optional YAML content, closing --- */
const frontmatterRegex = /^---[ \t]*(?:\r\n|\r|\n)([\s\S]*?)(?:\r\n|\r|\n)---[ \t]*(?:\r\n|\r|\n|$)/

/**
 * Parse a dotprompt source string into structured metadata and template.
 *
 * If the source contains YAML frontmatter (delimited by `---`), the dotprompt
 * package is used to extract metadata. If there is no frontmatter, the source
 * is returned as a plain template with empty metadata (backward compatibility).
 */
export function parseDotprompt(source: string): ParsedDotprompt {
  // No frontmatter delimiter at all — plain template
  if (!source.startsWith('---')) {
    return { source, metadata: {}, template: source }
  }

  // Empty frontmatter (---\n---\n...) — dotprompt doesn't handle this,
  // so we strip the delimiters manually
  const fmMatch = source.match(frontmatterRegex)
  if (!fmMatch || fmMatch[1].trim() === '') {
    const template = source.replace(/^---[ \t]*(?:\r\n|\r|\n)---[ \t]*(?:\r\n|\r|\n)?/, '')
    return { source, metadata: {}, template }
  }

  // Delegate to the dotprompt package for real frontmatter
  let parsed: ReturnType<typeof dp.parse>
  try {
    parsed = dp.parse(source)
  } catch {
    return { source, metadata: {}, template: source }
  }

  const metadata: PromptMetadata = {}
  if (parsed.model) metadata.model = parsed.model
  if (parsed.config && Object.keys(parsed.config).length > 0) metadata.config = parsed.config as Record<string, unknown>
  if (parsed.input) metadata.input = parsed.input
  if (parsed.output) metadata.output = parsed.output
  if (parsed.tools && parsed.tools.length > 0) metadata.tools = parsed.tools as string[]
  if (parsed.description) metadata.description = parsed.description
  const ext = (parsed.ext && Object.keys(parsed.ext).length > 0)
    ? parsed.ext
    : parsed.raw?.ext
  if (ext && Object.keys(ext).length > 0) metadata.ext = ext as Record<string, Record<string, unknown>>

  return {
    source,
    metadata,
    template: parsed.template,
  }
}

/**
 * Validate that a dotprompt source string has well-formed frontmatter.
 *
 * The dotprompt library silently swallows YAML parse errors, so we validate
 * the frontmatter YAML directly using the `yaml` package.
 */
export function validateDotprompt(source: string): ValidationResult {
  // No frontmatter — always valid (plain template)
  if (!source.startsWith('---')) {
    return { valid: true }
  }

  const fmMatch = source.match(frontmatterRegex)

  // Has opening --- but no valid frontmatter block
  if (!fmMatch) {
    return { valid: false, error: 'Malformed frontmatter delimiters' }
  }

  const yamlText = fmMatch[1].trim()

  // Empty frontmatter is fine
  if (yamlText === '') {
    return { valid: true }
  }

  // Validate the YAML content directly
  try {
    const parsed = YAML.parse(yamlText)
    if (parsed !== null && (typeof parsed !== 'object' || Array.isArray(parsed))) {
      return { valid: false, error: 'Frontmatter must be a YAML mapping, not a scalar or array' }
    }
    return { valid: true }
  } catch (e) {
    return {
      valid: false,
      error: e instanceof Error ? e.message : 'Invalid YAML in frontmatter',
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/__tests__/parser.test.ts`
Expected: PASS (all 12 tests)

**Step 5: Commit**

```bash
git add src/parser.ts src/__tests__/parser.test.ts
git commit -m "feat: add parseDotprompt and validateDotprompt functions"
```

---

### Task 4: Add metadata to Prompt interface and update exports

This task updates the core `Prompt` type and re-exports the new types and parser from the SDK's main entry point.

**Files:**
- Modify: `src/index.ts` (lines 23-51 for types, lines 1-7 for imports)
- Modify: `src/__tests__/index.test.ts`

**Step 1: Write the failing test**

Add to the top of `src/__tests__/index.test.ts`, after existing imports:

```typescript
import type { PromptMetadata, ParsedDotprompt, ValidationResult } from '../types'
```

Add a new test block after the `Teleprompter Utility Functions` describe:

```typescript
describe('Teleprompter type re-exports', () => {
  it('should have metadata as an optional field on Prompt', () => {
    const prompt: Teleprompter.Prompt = {
      id: 'test',
      prompt: 'Hello',
      version: 1,
    }
    // metadata is optional — old prompts without it should still be valid
    expect(prompt.metadata).toBeUndefined()
  })

  it('should accept metadata on Prompt', () => {
    const prompt: Teleprompter.Prompt = {
      id: 'test',
      prompt: '---\nmodel: test\n---\nHello',
      version: 1,
      metadata: { model: 'test' },
    }
    expect(prompt.metadata?.model).toBe('test')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test src/__tests__/index.test.ts`
Expected: FAIL — `metadata` does not exist on type `Teleprompter.Prompt`

**Step 3: Update the Prompt interface and add re-exports**

In `src/index.ts`:

1. Add import at the top (after the Mustache import, line 7):
```typescript
import type { PromptMetadata, ParsedDotprompt, ValidationResult } from './types'
```

2. Add re-exports after the import:
```typescript
export type { PromptMetadata, ParsedDotprompt, ValidationResult } from './types'
export { parseDotprompt, validateDotprompt } from './parser'
```

3. Update the `Prompt` interface (line 47-50) to include optional metadata:
```typescript
  export interface Prompt extends PromptInput {
    /** Version number of this prompt, increments with each update */
    version: number
    /** Metadata extracted from dotprompt YAML frontmatter */
    metadata?: PromptMetadata
  }
```

**Step 4: Run test to verify it passes**

Run: `bun test src/__tests__/index.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/index.ts src/__tests__/index.test.ts
git commit -m "feat: add metadata to Prompt interface and re-export types"
```

---

### Task 5: Update KV.render() to strip frontmatter before rendering

The `KV.render()` method currently passes the raw `prompt` field to Mustache. If the prompt uses dotprompt format, the YAML frontmatter would be included in the rendered output. This task makes `render()` parse out just the template body first.

**Files:**
- Modify: `src/index.ts` (KV class, lines 421-427)
- Modify: `src/__tests__/index.test.ts` (KV render tests)

**Step 1: Write the failing test**

Add a new test in the `Teleprompter.KV > render` describe block:

```typescript
    it('should strip frontmatter before rendering dotprompt templates', async () => {
      const mockPrompt: Teleprompter.Prompt = {
        id: 'dotprompt-test',
        prompt: '---\nmodel: test/model\n---\nHello {{name}}!',
        version: 1,
        metadata: { model: 'test/model' },
      }

      const mockKV = {
        get: mock(() => Promise.resolve(mockPrompt))
      } as unknown as KVNamespace

      const env: Teleprompter.ENV = { PROMPTS: mockKV }
      const kv = new Teleprompter.KV(env)

      const rendered = await kv.render('dotprompt-test', { name: 'World' })

      expect(rendered).toBe('Hello World!')
      // Should NOT contain frontmatter in rendered output
      expect(rendered).not.toContain('---')
      expect(rendered).not.toContain('model:')
    })
```

**Step 2: Run test to verify it fails**

Run: `bun test src/__tests__/index.test.ts`
Expected: FAIL — rendered output contains `---\nmodel: test/model\n---\nHello World!`

**Step 3: Update KV.render() to use parseDotprompt**

Add import at the top of `src/index.ts` (if not already present from Task 4):
```typescript
import { parseDotprompt } from './parser'
```

Update the `render` method (currently at line 421-427):

```typescript
    async render(id: string, ctx: any): Promise<string> {
      const prompt = await this.get(id)
      if (prompt === null) {
        throw new Error(`Prompt '${id}' not found`)
      }
      const { template } = parseDotprompt(prompt.prompt)
      return Mustache.render(template, ctx)
    }
```

**Step 4: Run test to verify it passes**

Run: `bun test src/__tests__/index.test.ts`
Expected: PASS (all tests including existing render tests)

**Step 5: Commit**

```bash
git add src/index.ts src/__tests__/index.test.ts
git commit -m "feat: strip frontmatter in KV.render() before template rendering"
```

---

### Task 6: Update UpdateMessage to include metadata

The server passes prompts with metadata through `Teleprompter.UpdateMessage()`. The `Messages.PromptUpdate` type extends `Prompt`, so it automatically gains the optional `metadata` field from Task 4. This task verifies that behavior works correctly with tests.

**Files:**
- Modify: `src/__tests__/index.test.ts` (UpdateMessage and HandleUpdates tests)

**Step 1: Write the failing test**

Add a new test in the `UpdateMessage` describe block:

```typescript
    it('should include metadata in the update message when present', () => {
      const prompt: Teleprompter.Prompt = {
        id: 'test-prompt',
        prompt: '---\nmodel: test\n---\nContent',
        version: 1,
        metadata: { model: 'test' },
      }

      const message = Teleprompter.UpdateMessage(prompt)

      expect(message).toEqual({
        id: 'test-prompt',
        prompt: '---\nmodel: test\n---\nContent',
        version: 1,
        metadata: { model: 'test' },
        type: 'prompt-update',
      })
    })
```

Add a new test in the `Teleprompter.HandleUpdates` describe block:

```typescript
  it('should store metadata in KV when handling prompt-update', async () => {
    const mockPrompt: Teleprompter.Prompt = {
      id: 'prompt1',
      prompt: '---\nmodel: test\n---\nHello',
      version: 2,
      metadata: { model: 'test' },
    }

    const mockBatch = {
      messages: [
        {
          body: {
            ...mockPrompt,
            type: 'prompt-update' as const
          }
        }
      ]
    } as unknown as MessageBatch<Teleprompter.Messages.PromptUpdate | Teleprompter.Messages.PromptDelete>

    const mockKV = {
      put: mock(() => Promise.resolve(undefined)),
      delete: mock(() => Promise.resolve(undefined))
    } as unknown as KVNamespace

    const env: Teleprompter.ENV = { PROMPTS: mockKV }
    const ctx = {} as ExecutionContext

    await Teleprompter.HandleUpdates(mockBatch, env, ctx)

    const storedValue = (mockKV.put as any).mock.calls[0][1]
    const parsed = JSON.parse(storedValue)
    expect(parsed.metadata).toEqual({ model: 'test' })
  })
```

**Step 2: Run tests to verify they pass**

Run: `bun test src/__tests__/index.test.ts`
Expected: PASS — metadata flows through `...prompt` spread in UpdateMessage and gets serialized in HandleUpdates. These tests should pass without code changes since the spread operator already includes all fields.

**Step 3: Commit**

```bash
git add src/__tests__/index.test.ts
git commit -m "test: verify metadata flows through UpdateMessage and HandleUpdates"
```

---

### Task 7: Run full test suite and build

**Step 1: Run all tests**

Run: `bun test`
Expected: All tests pass

**Step 2: Run build**

Run: `bun run build`
Expected: Clean compilation, `dist/` updated with new types and parser

**Step 3: Verify exports in compiled output**

Run: `ls dist/types.d.ts dist/parser.d.ts dist/index.d.ts`
Expected: All three declaration files exist

**Step 4: Commit build output if dist/ is tracked**

```bash
git add dist/
git commit -m "build: compile with dotprompt support"
```

---

### Task 8: Update README

**Files:**
- Modify: `README.md`

**Step 1: Update the README**

Key changes:
1. Replace Mustache references with dotprompt format description
2. Add a dotprompt example in the concepts section
3. Document `parseDotprompt()` and `validateDotprompt()` as exported utilities
4. Update KV rendering example to show dotprompt-format prompt
5. Mention that plain templates without frontmatter remain fully supported (backward compat)

Update the "Concepts" section to explain that prompts can now use dotprompt format (YAML frontmatter + Handlebars template body) with metadata extraction. Add an example:

```
---
model: anthropic/claude-sonnet-4-20250514
config:
  temperature: 0.3
input:
  schema:
    code: string
output:
  format: json
  schema:
    summary: string
---
Analyze this {{code}} and provide a summary.
```

Update the KV client section to mention that `render()` automatically strips frontmatter before rendering.

Add a "Parser Utilities" section showing:
```typescript
import { parseDotprompt, validateDotprompt } from 'teleprompter-sdk'

const { metadata, template } = parseDotprompt(source)
const validation = validateDotprompt(source)
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README for dotprompt format support"
```

---

### Task 9: Bump version

**Files:**
- Modify: `package.json`

**Step 1: Bump minor version**

Update `version` in `package.json` from `"0.1.1"` to `"0.2.0"` (minor bump since this adds new features with backward compatibility).

**Step 2: Commit**

```bash
git add package.json
git commit -m "chore: bump version to 0.2.0"
```
