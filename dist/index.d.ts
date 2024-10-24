/**
 * Teleprompter SDK
 *
 * This SDK provides methods to interact with the Teleprompter service.
 */
interface Fetcher {
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}
export declare namespace Teleprompter {
    /**
     * PromptInput specifies a new prompt.
     * @interface PromptInput
     */
    export interface PromptInput {
        id: string;
        prompt: string;
    }
    export interface ENV {
        TELEPROMPTER_UPDATES: Queue<Messages.PromptDelete | Messages.PromptUpdate>;
        PROMPTS: KVNamespace;
    }
    /**
     * Prompt is a versioned LLM prompt referenced by id.
     * @interface Prompt
     **/
    export interface Prompt extends PromptInput {
        version: number;
    }
    /**
    * TeleprompterSDK is an interface for interacting with a teleprompter service.
    * @interface TeleprompterSDK
    */
    export interface TeleprompterSDK {
        listPrompts(): Promise<Prompt[]>;
        getPrompt(id: string): Promise<Prompt>;
        getPromptVersions(id: string): Promise<Prompt[]>;
        writePrompt(prompt: PromptInput): Promise<void>;
        deletePrompt(id: string): Promise<void>;
        rollbackPrompt(id: string, version: number): Promise<void>;
    }
    namespace Messages {
        interface PromptUpdate extends Teleprompter.Prompt {
            type: 'prompt-update';
        }
        interface PromptDelete {
            id: string;
            type: 'prompt-delete';
        }
    }
    /**
     * Teleprompter HTTP SDK
     */
    export class HTTP implements TeleprompterSDK {
        private baseUrl?;
        private binding?;
        constructor(urlOrBinding: string | Fetcher);
        private fetch;
        /**
         * Get all prompts
         */
        listPrompts(): Promise<Prompt[]>;
        /**
         * Get a specific prompt by ID
         */
        getPrompt(id: string): Promise<Prompt>;
        /**
         * Get all versions of a specific prompt
         */
        getPromptVersions(id: string): Promise<Prompt[]>;
        /**
         * Create a new prompt or update an existing one
         */
        writePrompt(prompt: PromptInput): Promise<void>;
        /**
         * Delete a prompt
         */
        deletePrompt(id: string): Promise<void>;
        /**
         * Rollback a prompt to a previous version
         */
        rollbackPrompt(id: string, version: number): Promise<void>;
    }
    export function HandleUpdates(batch: MessageBatch<Messages.PromptUpdate | Messages.PromptDelete>, env: Teleprompter.ENV, ctx: ExecutionContext): Promise<void>;
    export class KV {
        private KV;
        constructor(env: Teleprompter.ENV);
        list(): Promise<Prompt[]>;
        get(id: string): Promise<Prompt | null>;
    }
    export {};
}
export default Teleprompter;
