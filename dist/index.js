/**
 * Teleprompter SDK
 *
 * This SDK provides methods to interact with the Teleprompter service.
 */
import Mustache from 'mustache';
import { parseDotprompt } from './parser';
export { parseDotprompt, validateDotprompt } from './parser';
export var Teleprompter;
(function (Teleprompter) {
    /**
     * Creates a delete message for queue-based prompt deletion.
     *
     * @param id - The unique identifier of the prompt to delete
     * @returns A PromptDelete message ready to be queued
     *
     * @example
     * ```ts
     * const message = Teleprompter.DeleteMessage('welcome-email');
     * await queue.send(message);
     * ```
     */
    function DeleteMessage(id) {
        return {
            id,
            type: 'prompt-delete'
        };
    }
    Teleprompter.DeleteMessage = DeleteMessage;
    /**
     * Creates an update message for queue-based prompt updates.
     *
     * @param prompt - The prompt data to update, including version
     * @returns A PromptUpdate message ready to be queued
     *
     * @example
     * ```ts
     * const message = Teleprompter.UpdateMessage({
     *   id: 'welcome-email',
     *   prompt: 'Welcome, {{name}}!',
     *   version: 2
     * });
     * await queue.send(message);
     * ```
     */
    function UpdateMessage(prompt) {
        return {
            ...prompt,
            type: 'prompt-update'
        };
    }
    Teleprompter.UpdateMessage = UpdateMessage;
    /**
     * HTTP client for interacting with a Teleprompter REST API.
     *
     * Supports both direct HTTP URLs and Cloudflare Worker service bindings
     * for flexible deployment scenarios. Implements the full TeleprompterSDK interface
     * for managing prompt templates over HTTP.
     *
     * @example
     * Using with a base URL:
     * ```ts
     * const client = new Teleprompter.HTTP('https://api.example.com');
     * const prompts = await client.listPrompts();
     * ```
     *
     * @example
     * Using with a Cloudflare Worker binding:
     * ```ts
     * const client = new Teleprompter.HTTP(env.API_BINDING);
     * const prompt = await client.getPrompt('welcome-email');
     * ```
     */
    class HTTP {
        baseUrl;
        binding;
        /**
         * Creates a new HTTP client instance.
         *
         * @param urlOrBinding - Either a base URL string (e.g., 'https://api.example.com')
         *                       or a Fetcher binding for Cloudflare Workers
         */
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
         * Retrieves all available prompts from the API.
         *
         * @returns Promise resolving to an array of all prompts
         * @throws Error if the HTTP request fails
         */
        async listPrompts() {
            const response = await this.fetch('/prompts');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        }
        /**
         * Retrieves a specific prompt by its ID.
         *
         * @param id - The unique identifier of the prompt
         * @returns Promise resolving to the requested prompt
         * @throws Error if the prompt is not found or the request fails
         */
        async getPrompt(id) {
            const response = await this.fetch(`/prompts/${id}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        }
        /**
         * Retrieves all versions of a specific prompt.
         *
         * @param id - The unique identifier of the prompt
         * @returns Promise resolving to an array of all versions of the prompt
         * @throws Error if the prompt is not found or the request fails
         */
        async getPromptVersions(id) {
            const response = await this.fetch(`/prompts/${id}/versions`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        }
        /**
         * Creates a new prompt or updates an existing one.
         *
         * @param prompt - The prompt data to write
         * @returns Promise that resolves when the operation completes
         * @throws Error if the write operation fails
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
         * Deletes a prompt by its ID.
         *
         * @param id - The unique identifier of the prompt to delete
         * @returns Promise that resolves when the deletion completes
         * @throws Error if the prompt is not found or deletion fails
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
         * Rolls back a prompt to a previous version.
         *
         * @param id - The unique identifier of the prompt
         * @param version - The version number to roll back to
         * @returns Promise that resolves when the rollback completes
         * @throws Error if the prompt or version is not found, or rollback fails
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
    /**
     * Queue consumer handler for processing prompt update and delete messages.
     *
     * This function is designed to be used as a Cloudflare Queue consumer handler.
     * It processes batches of prompt update and delete operations, writing them
     * to the KV namespace for fast edge access.
     *
     * @param batch - The message batch from the queue
     * @param env - Environment bindings containing the PROMPTS KV namespace
     * @param ctx - Execution context for the worker
     * @returns Promise that resolves when all messages in the batch are processed
     *
     * @example
     * ```ts
     * export default {
     *   async queue(batch, env, ctx) {
     *     await Teleprompter.HandleUpdates(batch, env, ctx);
     *   }
     * }
     * ```
     */
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
    /**
     * KV client for reading and rendering prompt templates from Cloudflare KV.
     *
     * Optimized for edge/serverless environments, this client provides fast access
     * to prompt templates stored in a KV namespace. Includes built-in Mustache
     * template rendering for dynamic prompt generation.
     *
     * @example
     * ```ts
     * const kv = new Teleprompter.KV(env);
     * const prompts = await kv.list();
     * const rendered = await kv.render('welcome-email', { name: 'Ada' });
     * ```
     */
    class KV {
        KV;
        /**
         * Creates a new KV client instance.
         *
         * @param env - Environment bindings containing the PROMPTS KV namespace
         */
        constructor(env) {
            this.KV = env.PROMPTS;
        }
        /**
         * Lists all prompts stored in the KV namespace.
         *
         * @returns Promise resolving to an array of all prompts (null values are filtered out)
         */
        async list() {
            const keys = await this.KV.list();
            const prompts = await Promise.all(keys.keys.map(async (key) => {
                const value = await this.KV.get(key.name, 'json');
                return value;
            }));
            return prompts.filter((prompt) => prompt !== null);
        }
        /**
         * Retrieves a specific prompt by its ID from KV.
         *
         * @param id - The unique identifier of the prompt
         * @returns Promise resolving to the prompt, or null if not found
         */
        async get(id) {
            return this.KV.get(id, 'json');
        }
        /**
         * Retrieves and renders a prompt template with the provided context.
         *
         * Uses Mustache for template rendering, supporting variables, conditionals,
         * and loops in your prompt templates.
         *
         * @param id - The unique identifier of the prompt template
         * @param ctx - The context object for template variable substitution
         * @returns Promise resolving to the rendered prompt string
         * @throws Error if the prompt is not found
         *
         * @example
         * ```ts
         * const output = await kv.render('welcome-email', {
         *   name: 'Ada',
         *   company: 'Acme Corp'
         * });
         * // Result: "Welcome, Ada! Thank you for joining Acme Corp."
         * ```
         */
        async render(id, ctx) {
            const prompt = await this.get(id);
            if (prompt === null) {
                throw new Error(`Prompt '${id}' not found`);
            }
            const { template } = parseDotprompt(prompt.prompt);
            return Mustache.render(template, ctx);
        }
    }
    Teleprompter.KV = KV;
})(Teleprompter || (Teleprompter = {}));
export default Teleprompter;
