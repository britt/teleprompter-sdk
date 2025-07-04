/**
 * Teleprompter SDK
 *
 * This SDK provides methods to interact with the Teleprompter service.
 */
import Mustache from 'mustache';
export var Teleprompter;
(function (Teleprompter) {
    function DeleteMessage(id) {
        return {
            id,
            type: 'prompt-delete'
        };
    }
    Teleprompter.DeleteMessage = DeleteMessage;
    function UpdateMessage(prompt) {
        return {
            ...prompt,
            type: 'prompt-update'
        };
    }
    Teleprompter.UpdateMessage = UpdateMessage;
    /**
     * Teleprompter HTTP SDK
     */
    class HTTP {
        baseUrl;
        binding;
        constructor(urlOrBinding) {
            if (typeof urlOrBinding === 'string') {
                this.baseUrl = urlOrBinding;
            }
            else {
                this.binding = urlOrBinding;
            }
        }
        async fetch(path, init) {
            if (this.baseUrl) {
                const url = new URL(path, this.baseUrl);
                return fetch(url.toString(), init);
            }
            else if (this.binding) {
                const url = new URL(path, 'https://dummy');
                return this.binding.fetch(url.toString(), init);
            }
            else {
                throw new Error('TeleprompterSDK was not initialized correctly');
            }
        }
        /**
         * Get all prompts
         */
        async listPrompts() {
            const response = await this.fetch('/prompts');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        }
        /**
         * Get a specific prompt by ID
         */
        async getPrompt(id) {
            const response = await this.fetch(`/prompts/${id}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        }
        /**
         * Get all versions of a specific prompt
         */
        async getPromptVersions(id) {
            const response = await this.fetch(`/prompts/${id}/versions`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        }
        /**
         * Create a new prompt or update an existing one
         */
        async writePrompt(prompt) {
            const response = await this.fetch('/prompts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(prompt),
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        }
        /**
         * Delete a prompt
         */
        async deletePrompt(id) {
            const response = await this.fetch(`/prompts/${id}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        }
        /**
         * Rollback a prompt to a previous version
         */
        async rollbackPrompt(id, version) {
            const response = await this.fetch(`/prompts/${id}/versions/${version}`, {
                method: 'POST',
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        }
    }
    Teleprompter.HTTP = HTTP;
    async function HandleUpdates(batch, env, ctx) {
        for (let message of batch.messages) {
            switch (message.body.type) {
                case 'prompt-update':
                    await env.PROMPTS.put(message.body.id, JSON.stringify(message.body));
                    break;
                case 'prompt-delete':
                    await env.PROMPTS.delete(message.body.id);
                    break;
            }
        }
    }
    Teleprompter.HandleUpdates = HandleUpdates;
    class KV {
        KV;
        constructor(env) {
            this.KV = env.PROMPTS;
        }
        async list() {
            const keys = await this.KV.list();
            const prompts = await Promise.all(keys.keys.map(async (key) => {
                const value = await this.KV.get(key.name, 'json');
                return value;
            }));
            return prompts.filter((prompt) => prompt !== null);
        }
        async get(id) {
            return this.KV.get(id, 'json');
        }
        async render(id, ctx) {
            const prompt = await this.get(id);
            if (prompt === null) {
                throw new Error(`Prompt '${id}' not found`);
            }
            return Mustache.render(prompt?.prompt, ctx);
        }
    }
    Teleprompter.KV = KV;
})(Teleprompter || (Teleprompter = {}));
export default Teleprompter;
