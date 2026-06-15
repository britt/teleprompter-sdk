import { describe, it, expect, mock } from 'bun:test'
import { Teleprompter, Fetcher } from '../index'
import type { PromptMetadata, ParsedDotprompt, ValidationResult } from '../types'

describe('Teleprompter Utility Functions', () => {
  describe('DeleteMessage', () => {
    it('should create a delete message with correct id and type', () => {
      const id = 'test-prompt-id'
      const message = Teleprompter.DeleteMessage(id)

      expect(message).toEqual({
        id: 'test-prompt-id',
        type: 'prompt-delete'
      })
    })
  })

  describe('UpdateMessage', () => {
    it('should create an update message with prompt data and type', () => {
      const prompt: Teleprompter.Prompt = {
        id: 'test-prompt',
        prompt: 'Test prompt content',
        version: 1
      }

      const message = Teleprompter.UpdateMessage(prompt)

      expect(message).toEqual({
        id: 'test-prompt',
        prompt: 'Test prompt content',
        version: 1,
        type: 'prompt-update'
      })
    })

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
  })
})

describe('Teleprompter type re-exports', () => {
  it('should have metadata as an optional field on Prompt', () => {
    const prompt: Teleprompter.Prompt = {
      id: 'test',
      prompt: 'Hello',
      version: 1,
    }
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

describe('Teleprompter.HTTP', () => {
  describe('constructor', () => {
    it('should initialize with baseUrl when given a string', () => {
      const sdk = new Teleprompter.HTTP('https://api.example.com')
      expect(sdk).toBeInstanceOf(Teleprompter.HTTP)
    })

    it('should initialize with binding when given a Fetcher', () => {
      const mockFetcher: Fetcher = {
        fetch: mock(() => Promise.resolve({} as Response))
      }
      const sdk = new Teleprompter.HTTP(mockFetcher)
      expect(sdk).toBeInstanceOf(Teleprompter.HTTP)
    })
  })

  describe('listPrompts', () => {
    it('should fetch and return list of prompts', async () => {
      const mockPrompts: Teleprompter.Prompt[] = [
        { id: 'prompt1', prompt: 'First prompt', version: 1 },
        { id: 'prompt2', prompt: 'Second prompt', version: 1 }
      ]

      const mockFetch = mock(() => Promise.resolve({
        ok: true,
        json: async () => mockPrompts
      } as Response))

      globalThis.fetch = mockFetch as any

      const sdk = new Teleprompter.HTTP('https://api.example.com')
      const prompts = await sdk.listPrompts()

      expect(prompts).toEqual(mockPrompts)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/prompts',
        undefined
      )
    })

    it('should throw error when response is not ok', async () => {
      globalThis.fetch = mock(() => Promise.resolve({
        ok: false,
        status: 500
      } as Response)) as any

      const sdk = new Teleprompter.HTTP('https://api.example.com')

      await expect(sdk.listPrompts()).rejects.toThrow('HTTP error! status: 500')
    })

    it('should work with binding fetcher', async () => {
      const mockPrompts: Teleprompter.Prompt[] = [
        { id: 'prompt1', prompt: 'First prompt', version: 1 }
      ]

      const mockFetchFn = mock(() => Promise.resolve({
        ok: true,
        json: async () => mockPrompts
      } as Response))

      const mockFetcher: Fetcher = {
        fetch: mockFetchFn as any
      }

      const sdk = new Teleprompter.HTTP(mockFetcher)
      const prompts = await sdk.listPrompts()

      expect(prompts).toEqual(mockPrompts)
      expect(mockFetchFn).toHaveBeenCalledWith(
        'https://dummy/prompts',
        undefined
      )
    })
  })

  describe('getPrompt', () => {
    it('should fetch and return a specific prompt', async () => {
      const mockPrompt: Teleprompter.Prompt = {
        id: 'prompt1',
        prompt: 'Test prompt',
        version: 1
      }

      const mockFetch = mock(() => Promise.resolve({
        ok: true,
        json: async () => mockPrompt
      } as Response))

      globalThis.fetch = mockFetch as any

      const sdk = new Teleprompter.HTTP('https://api.example.com')
      const prompt = await sdk.getPrompt('prompt1')

      expect(prompt).toEqual(mockPrompt)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/prompts/prompt1',
        undefined
      )
    })

    it('should throw error when response is not ok', async () => {
      globalThis.fetch = mock(() => Promise.resolve({
        ok: false,
        status: 404
      } as Response)) as any

      const sdk = new Teleprompter.HTTP('https://api.example.com')

      await expect(sdk.getPrompt('nonexistent')).rejects.toThrow('HTTP error! status: 404')
    })
  })

  describe('getPromptVersions', () => {
    it('should fetch and return all versions of a prompt', async () => {
      const mockVersions: Teleprompter.Prompt[] = [
        { id: 'prompt1', prompt: 'Version 1', version: 1 },
        { id: 'prompt1', prompt: 'Version 2', version: 2 }
      ]

      globalThis.fetch = mock(() => Promise.resolve({
        ok: true,
        json: async () => mockVersions
      } as Response)) as any

      const sdk = new Teleprompter.HTTP('https://api.example.com')
      const versions = await sdk.getPromptVersions('prompt1')

      expect(versions).toEqual(mockVersions)
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.example.com/prompts/prompt1/versions',
        undefined
      )
    })

    it('should throw error when response is not ok', async () => {
      globalThis.fetch = mock(() => Promise.resolve({
        ok: false,
        status: 404
      } as Response)) as any

      const sdk = new Teleprompter.HTTP('https://api.example.com')

      await expect(sdk.getPromptVersions('nonexistent')).rejects.toThrow('HTTP error! status: 404')
    })
  })

  describe('writePrompt', () => {
    it('should POST a new prompt', async () => {
      const promptInput: Teleprompter.PromptInput = {
        id: 'new-prompt',
        prompt: 'New prompt content'
      }

      globalThis.fetch = mock(() => Promise.resolve({
        ok: true
      } as Response)) as any

      const sdk = new Teleprompter.HTTP('https://api.example.com')
      await sdk.writePrompt(promptInput)

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.example.com/prompts',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(promptInput)
        }
      )
    })

    it('should throw error when response is not ok', async () => {
      const promptInput: Teleprompter.PromptInput = {
        id: 'new-prompt',
        prompt: 'New prompt content'
      }

      globalThis.fetch = mock(() => Promise.resolve({
        ok: false,
        status: 400
      } as Response)) as any

      const sdk = new Teleprompter.HTTP('https://api.example.com')

      await expect(sdk.writePrompt(promptInput)).rejects.toThrow('HTTP error! status: 400')
    })
  })

  describe('deletePrompt', () => {
    it('should DELETE a prompt', async () => {
      globalThis.fetch = mock(() => Promise.resolve({
        ok: true
      } as Response)) as any

      const sdk = new Teleprompter.HTTP('https://api.example.com')
      await sdk.deletePrompt('prompt1')

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.example.com/prompts/prompt1',
        { method: 'DELETE' }
      )
    })

    it('should throw error when response is not ok', async () => {
      globalThis.fetch = mock(() => Promise.resolve({
        ok: false,
        status: 404
      } as Response)) as any

      const sdk = new Teleprompter.HTTP('https://api.example.com')

      await expect(sdk.deletePrompt('nonexistent')).rejects.toThrow('HTTP error! status: 404')
    })
  })

  describe('rollbackPrompt', () => {
    it('should POST to rollback a prompt to a specific version', async () => {
      globalThis.fetch = mock(() => Promise.resolve({
        ok: true
      } as Response)) as any

      const sdk = new Teleprompter.HTTP('https://api.example.com')
      await sdk.rollbackPrompt('prompt1', 5)

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.example.com/prompts/prompt1/versions/5',
        { method: 'POST' }
      )
    })

    it('should throw error when response is not ok', async () => {
      globalThis.fetch = mock(() => Promise.resolve({
        ok: false,
        status: 400
      } as Response)) as any

      const sdk = new Teleprompter.HTTP('https://api.example.com')

      await expect(sdk.rollbackPrompt('prompt1', 999)).rejects.toThrow('HTTP error! status: 400')
    })
  })

  describe('fetch error handling', () => {
    it('should throw error when neither baseUrl nor binding is set', async () => {
      const sdk = new Teleprompter.HTTP('https://api.example.com')
      // Force clear both properties to test error path
      ;(sdk as any).baseUrl = undefined
      ;(sdk as any).binding = undefined

      await expect(sdk.listPrompts()).rejects.toThrow('TeleprompterSDK was not initialized correctly')
    })
  })
})

describe('Teleprompter.HandleUpdates', () => {
  it('should handle prompt-update messages', async () => {
    const mockPrompt: Teleprompter.Prompt = {
      id: 'prompt1',
      prompt: 'Updated prompt',
      version: 2
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

    const env: Teleprompter.ENV = {
      PROMPTS: mockKV
    }

    const ctx = {} as ExecutionContext

    await Teleprompter.HandleUpdates(mockBatch, env, ctx)

    expect(mockKV.put).toHaveBeenCalledWith(
      'prompt1',
      JSON.stringify({ ...mockPrompt, type: 'prompt-update' })
    )
    expect(mockKV.delete).not.toHaveBeenCalled()
  })

  it('should handle prompt-delete messages', async () => {
    const mockBatch = {
      messages: [
        {
          body: {
            id: 'prompt1',
            type: 'prompt-delete' as const
          }
        }
      ]
    } as unknown as MessageBatch<Teleprompter.Messages.PromptUpdate | Teleprompter.Messages.PromptDelete>

    const mockKV = {
      put: mock(() => Promise.resolve(undefined)),
      delete: mock(() => Promise.resolve(undefined))
    } as unknown as KVNamespace

    const env: Teleprompter.ENV = {
      PROMPTS: mockKV
    }

    const ctx = {} as ExecutionContext

    await Teleprompter.HandleUpdates(mockBatch, env, ctx)

    expect(mockKV.delete).toHaveBeenCalledWith('prompt1')
    expect(mockKV.put).not.toHaveBeenCalled()
  })

  it('should handle multiple messages in a batch', async () => {
    const mockBatch = {
      messages: [
        {
          body: {
            id: 'prompt1',
            prompt: 'First prompt',
            version: 1,
            type: 'prompt-update' as const
          }
        },
        {
          body: {
            id: 'prompt2',
            type: 'prompt-delete' as const
          }
        }
      ]
    } as unknown as MessageBatch<Teleprompter.Messages.PromptUpdate | Teleprompter.Messages.PromptDelete>

    const mockKV = {
      put: mock(() => Promise.resolve(undefined)),
      delete: mock(() => Promise.resolve(undefined)).mockResolvedValue(undefined)
    } as unknown as KVNamespace

    const env: Teleprompter.ENV = {
      PROMPTS: mockKV
    }

    const ctx = {} as ExecutionContext

    await Teleprompter.HandleUpdates(mockBatch, env, ctx)

    expect(mockKV.put).toHaveBeenCalledTimes(1)
    expect(mockKV.delete).toHaveBeenCalledTimes(1)
  })

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
})

describe('Teleprompter.KV', () => {
  describe('list', () => {
    it('should return all prompts from KV store', async () => {
      const mockPrompts: Teleprompter.Prompt[] = [
        { id: 'prompt1', prompt: 'First', version: 1 },
        { id: 'prompt2', prompt: 'Second', version: 1 }
      ]

      let callCount = 0
      const mockKV = {
        list: mock(() => Promise.resolve({
          keys: [
            { name: 'prompt1' },
            { name: 'prompt2' }
          ]
        })),
        get: mock(() => {
          const value = callCount === 0 ? mockPrompts[0] : mockPrompts[1]
          callCount++
          return Promise.resolve(value)
        })
      } as unknown as KVNamespace

      const env: Teleprompter.ENV = { PROMPTS: mockKV }
      const kv = new Teleprompter.KV(env)

      const prompts = await kv.list()

      expect(prompts).toEqual(mockPrompts)
      expect(mockKV.list).toHaveBeenCalled()
      expect(mockKV.get).toHaveBeenCalledWith('prompt1', 'json')
      expect(mockKV.get).toHaveBeenCalledWith('prompt2', 'json')
    })

    it('should filter out null values', async () => {
      let callCount = 0
      const mockKV = {
        list: mock(() => Promise.resolve({
          keys: [
            { name: 'prompt1' },
            { name: 'prompt2' }
          ]
        })),
        get: mock(() => {
          const value = callCount === 0 ? { id: 'prompt1', prompt: 'First', version: 1 } : null
          callCount++
          return Promise.resolve(value)
        })
      } as unknown as KVNamespace

      const env: Teleprompter.ENV = { PROMPTS: mockKV }
      const kv = new Teleprompter.KV(env)

      const prompts = await kv.list()

      expect(prompts).toHaveLength(1)
      expect(prompts[0].id).toBe('prompt1')
    })
  })

  describe('get', () => {
    it('should return a specific prompt from KV store', async () => {
      const mockPrompt: Teleprompter.Prompt = {
        id: 'prompt1',
        prompt: 'Test prompt',
        version: 1
      }

      const mockKV = {
        get: mock(() => Promise.resolve(mockPrompt))
      } as unknown as KVNamespace

      const env: Teleprompter.ENV = { PROMPTS: mockKV }
      const kv = new Teleprompter.KV(env)

      const prompt = await kv.get('prompt1')

      expect(prompt).toEqual(mockPrompt)
      expect(mockKV.get).toHaveBeenCalledWith('prompt1', 'json')
    })

    it('should return null when prompt does not exist', async () => {
      const mockKV = {
        get: mock(() => Promise.resolve(null))
      } as unknown as KVNamespace

      const env: Teleprompter.ENV = { PROMPTS: mockKV }
      const kv = new Teleprompter.KV(env)

      const prompt = await kv.get('nonexistent')

      expect(prompt).toBeNull()
    })
  })

  describe('render', () => {
    it('should render a prompt with Mustache template', async () => {
      const mockPrompt: Teleprompter.Prompt = {
        id: 'greeting',
        prompt: 'Hello {{name}}!',
        version: 1
      }

      const mockKV = {
        get: mock(() => Promise.resolve(mockPrompt))
      } as unknown as KVNamespace

      const env: Teleprompter.ENV = { PROMPTS: mockKV }
      const kv = new Teleprompter.KV(env)

      const rendered = await kv.render('greeting', { name: 'World' })

      expect(rendered).toBe('Hello World!')
      expect(mockKV.get).toHaveBeenCalledWith('greeting', 'json')
    })

    it('should throw error when prompt is not found', async () => {
      const mockKV = {
        get: mock(() => Promise.resolve(null))
      } as unknown as KVNamespace

      const env: Teleprompter.ENV = { PROMPTS: mockKV }
      const kv = new Teleprompter.KV(env)

      await expect(kv.render('nonexistent', {})).rejects.toThrow("Prompt 'nonexistent' not found")
    })

    it('should render complex Mustache templates', async () => {
      const mockPrompt: Teleprompter.Prompt = {
        id: 'complex',
        prompt: 'Items: {{#items}}{{name}}, {{/items}}',
        version: 1
      }

      const mockKV = {
        get: mock(() => Promise.resolve(mockPrompt))
      } as unknown as KVNamespace

      const env: Teleprompter.ENV = { PROMPTS: mockKV }
      const kv = new Teleprompter.KV(env)

      const rendered = await kv.render('complex', {
        items: [
          { name: 'Item 1' },
          { name: 'Item 2' }
        ]
      })

      expect(rendered).toBe('Items: Item 1, Item 2, ')
    })

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
      expect(rendered).not.toContain('---')
      expect(rendered).not.toContain('model:')
    })
  })
})
