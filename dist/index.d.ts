/**
 * Teleprompter SDK
 *
 * This SDK provides methods to interact with the Teleprompter service.
 */
import type { PromptMetadata } from './types';
export type { PromptMetadata, ParsedDotprompt, ValidationResult } from './types';
export { parseDotprompt, validateDotprompt } from './parser';
/**
 * A Fetcher interface compatible with Cloudflare Workers service bindings and standard fetch API.
 * Used for dependency injection to support both HTTP URLs and Worker bindings.
 */
export interface Fetcher {
    /**
     * Performs an HTTP request
     * @param input - The URL or RequestInfo to fetch
     * @param init - Optional request initialization parameters
     * @returns A Promise that resolves to the Response
     */
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}
export declare namespace Teleprompter {
    /**
     * PromptInput specifies a new prompt without version information.
     * Used when creating or updating prompts.
     */
    interface PromptInput {
        /** Unique identifier for the prompt */
        id: string;
        /** The prompt template text, may include Mustache template variables */
        prompt: string;
    }
    /**
     * Environment bindings for Cloudflare Workers.
     * Contains KV namespace bindings required by the SDK.
     */
    interface ENV {
        /** KV namespace for storing prompt templates */
        PROMPTS: KVNamespace;
    }
    /**
     * A versioned LLM prompt template.
     * Extends PromptInput with version tracking for history and rollback capabilities.
     */
    interface Prompt extends PromptInput {
        /** Version number of this prompt, increments with each update */
        version: number;
        /** Metadata extracted from dotprompt YAML frontmatter */
        metadata?: PromptMetadata;
    }
    /**
     * Core interface for Teleprompter SDK implementations.
     * Defines the contract for managing prompt templates including CRUD operations and versioning.
     */
    interface TeleprompterSDK {
        /**
         * Retrieves all available prompts
         * @returns Promise resolving to an array of all prompts
         */
        listPrompts(): Promise<Prompt[]>;
        /**
         * Retrieves a specific prompt by its ID
         * @param id - The unique identifier of the prompt
         * @returns Promise resolving to the prompt
         */
        getPrompt(id: string): Promise<Prompt>;
        /**
         * Retrieves all versions of a specific prompt
         * @param id - The unique identifier of the prompt
         * @returns Promise resolving to an array of all prompt versions
         */
        getPromptVersions(id: string): Promise<Prompt[]>;
        /**
         * Creates a new prompt or updates an existing one
         * @param prompt - The prompt data to write
         * @returns Promise that resolves when the operation completes
         */
        writePrompt(prompt: PromptInput): Promise<void>;
        /**
         * Deletes a prompt by its ID
         * @param id - The unique identifier of the prompt to delete
         * @returns Promise that resolves when the deletion completes
         */
        deletePrompt(id: string): Promise<void>;
        /**
         * Rolls back a prompt to a previous version
         * @param id - The unique identifier of the prompt
         * @param version - The version number to roll back to
         * @returns Promise that resolves when the rollback completes
         */
        rollbackPrompt(id: string, version: number): Promise<void>;
    }
    /**
     * Message types for Cloudflare Queue integration.
     * Used for asynchronous prompt updates and deletions via message queues.
     */
    namespace Messages {
        /**
         * Message payload for updating a prompt in the queue.
         * Contains the full prompt data including version information.
         */
        interface PromptUpdate extends Teleprompter.Prompt {
            /** Message type discriminator */
            type: 'prompt-update';
        }
        /**
         * Message payload for deleting a prompt in the queue.
         * Contains only the prompt ID to identify which prompt to delete.
         */
        interface PromptDelete {
            /** Unique identifier of the prompt to delete */
            id: string;
            /** Message type discriminator */
            type: 'prompt-delete';
        }
    }
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
    function DeleteMessage(id: string): Messages.PromptDelete;
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
    function UpdateMessage(prompt: Prompt): Messages.PromptUpdate;
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
    class HTTP implements TeleprompterSDK {
        private baseUrl?;
        private binding?;
        /**
         * Creates a new HTTP client instance.
         *
         * @param urlOrBinding - Either a base URL string (e.g., 'https://api.example.com')
         *                       or a Fetcher binding for Cloudflare Workers
         */
        constructor(urlOrBinding: string | Fetcher);
        private fetch;
        /**
         * Retrieves all available prompts from the API.
         *
         * @returns Promise resolving to an array of all prompts
         * @throws Error if the HTTP request fails
         */
        listPrompts(): Promise<Prompt[]>;
        /**
         * Retrieves a specific prompt by its ID.
         *
         * @param id - The unique identifier of the prompt
         * @returns Promise resolving to the requested prompt
         * @throws Error if the prompt is not found or the request fails
         */
        getPrompt(id: string): Promise<Prompt>;
        /**
         * Retrieves all versions of a specific prompt.
         *
         * @param id - The unique identifier of the prompt
         * @returns Promise resolving to an array of all versions of the prompt
         * @throws Error if the prompt is not found or the request fails
         */
        getPromptVersions(id: string): Promise<Prompt[]>;
        /**
         * Creates a new prompt or updates an existing one.
         *
         * @param prompt - The prompt data to write
         * @returns Promise that resolves when the operation completes
         * @throws Error if the write operation fails
         */
        writePrompt(prompt: PromptInput): Promise<void>;
        /**
         * Deletes a prompt by its ID.
         *
         * @param id - The unique identifier of the prompt to delete
         * @returns Promise that resolves when the deletion completes
         * @throws Error if the prompt is not found or deletion fails
         */
        deletePrompt(id: string): Promise<void>;
        /**
         * Rolls back a prompt to a previous version.
         *
         * @param id - The unique identifier of the prompt
         * @param version - The version number to roll back to
         * @returns Promise that resolves when the rollback completes
         * @throws Error if the prompt or version is not found, or rollback fails
         */
        rollbackPrompt(id: string, version: number): Promise<void>;
    }
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
    function HandleUpdates(batch: MessageBatch<Messages.PromptUpdate | Messages.PromptDelete>, env: Teleprompter.ENV, ctx: ExecutionContext): Promise<void>;
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
        private KV;
        /**
         * Creates a new KV client instance.
         *
         * @param env - Environment bindings containing the PROMPTS KV namespace
         */
        constructor(env: Teleprompter.ENV);
        /**
         * Lists all prompts stored in the KV namespace.
         *
         * @returns Promise resolving to an array of all prompts (null values are filtered out)
         */
        list(): Promise<Prompt[]>;
        /**
         * Retrieves a specific prompt by its ID from KV.
         *
         * @param id - The unique identifier of the prompt
         * @returns Promise resolving to the prompt, or null if not found
         */
        get(id: string): Promise<Prompt | null>;
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
        render(id: string, ctx: any): Promise<string>;
    }
}
export default Teleprompter;
