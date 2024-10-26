/**
 * Teleprompter SDK
 * 
 * This SDK provides methods to interact with the Teleprompter service.
 */
interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export namespace Teleprompter {
  /**
   * PromptInput specifies a new prompt.
   * @interface PromptInput
   */
  export interface PromptInput {
    id: string
    prompt: string
  }
  export interface ENV {
    TELEPROMPTER_UPDATES: Queue<Messages.PromptDelete | Messages.PromptUpdate>
    PROMPTS: KVNamespace
  }
  /**
   * Prompt is a versioned LLM prompt referenced by id.
   * @interface Prompt
   **/
  export interface Prompt extends PromptInput {
    version: number
  }

  /**
  * TeleprompterSDK is an interface for interacting with a teleprompter service.
  * @interface TeleprompterSDK
  */
  export interface TeleprompterSDK {
   listPrompts(): Promise<Prompt[]>
   getPrompt(id: string): Promise<Prompt>
   getPromptVersions(id: string): Promise<Prompt[]>
   writePrompt(prompt: PromptInput): Promise<void>
   deletePrompt(id: string): Promise<void>
   rollbackPrompt(id: string, version: number): Promise<void>
 }

  namespace Messages {
    export interface PromptUpdate extends Teleprompter.Prompt {
      type: 'prompt-update'
    }
    export interface PromptDelete {
      id: string
      type: 'prompt-delete'
    }
  }

  export function DeleteMessage(id: string): Messages.PromptDelete {
    return {
      id,
      type: 'prompt-delete'
    }
  }

  export  function UpdateMessage(prompt: Prompt): Messages.PromptUpdate {
    return {
      ...prompt,
      type: 'prompt-update'
    }
  }

  /**
   * Teleprompter HTTP SDK
   */
  export class HTTP implements TeleprompterSDK {
    private baseUrl?: string
    private binding?: Fetcher

    constructor(urlOrBinding: string | Fetcher) {
      if (typeof urlOrBinding === 'string') {
        this.baseUrl = urlOrBinding
      } else {
        this.binding = urlOrBinding
      }
    }

    private async fetch(path: string, init?: RequestInit): Promise<Response> {
      if (this.baseUrl) {
        const url = new URL(path, this.baseUrl)
        return fetch(url.toString(), init)
      } else if (this.binding) {
        const url = new URL(path, 'https://dummy')
        return this.binding.fetch(url.toString(), init)
      } else {
        throw new Error('TeleprompterSDK was not initialized correctly')
      }
    }

    /**
     * Get all prompts
     */
    async listPrompts(): Promise<Prompt[]> {
      const response = await this.fetch('/prompts')
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      return response.json()
    }

    /**
     * Get a specific prompt by ID
     */
    async getPrompt(id: string): Promise<Prompt> {
      const response = await this.fetch(`/prompts/${id}`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      return response.json()
    }

    /**
     * Get all versions of a specific prompt
     */
    async getPromptVersions(id: string): Promise<Prompt[]> {
      const response = await this.fetch(`/prompts/${id}/versions`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      return response.json()
    }

    /**
     * Create a new prompt or update an existing one
     */
    async writePrompt(prompt: PromptInput): Promise<void> {
      const response = await this.fetch('/prompts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(prompt),
      })
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
    }

    /**
     * Delete a prompt
     */
    async deletePrompt(id: string): Promise<void> {
      const response = await this.fetch(`/prompts/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
    }

    /**
     * Rollback a prompt to a previous version
     */
    async rollbackPrompt(id: string, version: number): Promise<void> {
      const response = await this.fetch(`/prompts/${id}/versions/${version}`, {
        method: 'POST',
      })
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
    }
  }

  export async function HandleUpdates(batch: MessageBatch<Messages.PromptUpdate | Messages.PromptDelete>, env: Teleprompter.ENV, ctx: ExecutionContext): Promise<void> {
    for (let message of batch.messages) {
      switch (message.body.type) {
        case 'prompt-update':
          await env.PROMPTS.put(message.body.id, JSON.stringify(message.body))
          break
        case 'prompt-delete':
          await env.PROMPTS.delete(message.body.id)
          break
      }
    }
  } 

  export class KV  {
    private KV: KVNamespace

    constructor(env: Teleprompter.ENV) {
      this.KV = env.PROMPTS
    }

    async list(): Promise<Prompt[]> {
      const keys = await this.KV.list()
      const prompts = await Promise.all(keys.keys.map(async (key) => {
        const value = await this.KV.get<Prompt>(key.name, 'json')
        return value
      }))
      return prompts.filter((prompt) => prompt !== null)
    }

    async get(id: string): Promise<Prompt | null> {
      return this.KV.get<Prompt>(id, 'json')
    }
  }
}

export default Teleprompter


