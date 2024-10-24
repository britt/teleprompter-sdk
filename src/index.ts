/**
 * Teleprompter SDK
 * 
 * This SDK provides methods to interact with the Teleprompter service.
 */

interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export class TeleprompterDOSDK implements TeleprompterSDK {
  private do: TeleprompterDO

  constructor(doInstance: TeleprompterDO) {
    this.do = doInstance
  }

  async listPrompts(): Promise<Prompt[]> {
    return this.do.list()
  }

  async getPrompt(id: string): Promise<Prompt> {
    return this.do.get(id)
  }

  async getPromptVersions(id: string): Promise<Prompt[]> {
    return this.do.getVersions(id)
  }

  async writePrompt(prompt: PromptInput): Promise<void> {
    return this.do.write(prompt)
  }

  async deletePrompt(id: string): Promise<void> {
    return this.do.delete(id)
  }

  async rollbackPrompt(id: string, version: number): Promise<void> {
    const v = await this.getPromptVersions(id)
    const rbVer = v.find(v => v.version === version)
    if (!rbVer) {
      throw new Error('Version not found')
    }
    return this.writePrompt({ id, prompt: rbVer.prompt })
  }
}

export class TeleprompterHTTPSDK implements TeleprompterSDK {
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
