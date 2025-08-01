# Teleprompter SDK

Teleprompter SDK is a TypeScript/JavaScript client library that enables developers to work with prompt management APIs and infrastructure provided by the Teleprompter platform. The SDK offers utilities to interact with Teleprompter APIs either over HTTP or by fetching and rendering prompt templates stored directly in a Cloudflare KV namespace, making it suitable for backend as well as edge/serverless environments.

## Concepts: HTTP and KV Clients

The library exposes two primary client types, targeting different use cases and environments:

### 1. HTTP Client
The `HTTP` client is designed to interact with a Teleprompter REST API server. It provides methods to list, read, update, and version prompt templates managed by your service. The API is intended for situations where you have a remote prompt registry or require centralized management (for example, enterprise APIs or development/CI/CD environments).

#### When should you use the HTTP client?
- When you want to remotely manage, version, and audit your LLM prompt templates.
- If you are consuming prompts from an API that tracks prompt history and provides workflow integrations.
- In backend services, CI pipelines, or anywhere you want programmatic access to Teleprompter's HTTP API.

### 2. KV Client
The `KV` client wraps access to a Cloudflare KV namespace that stores prompt templates. It is focused on scenarios where you want fast, serverless environment interpolation and rendering. The client seamlessly integrates with Mustache to interpolate variables directly on the edge, returning the generated prompt text.

#### When should you use the KV client?
- When deploying prompt templates for use in Cloudflare Workers, edge runtimes, or similar environments.
- For ultra-low latency, low-overhead rendering of prompts with runtime data.
- As a companion to the HTTP registry: prompts may be published from HTTP to KV for global, performant access.

This dual-client approach gives you flexibility to manage, distribute, and consume LLM prompts in a way that matches your architecture and runtime needs.

---

## Installation

```bash
npm install teleprompter-sdk
```

---

## Usage Examples

### HTTP Client Example

Create an `HTTP` instance with either a base URL or a `Fetcher` binding. The client implements methods for listing, retrieving, updating, and managing prompt templates remotely.

```ts
import Teleprompter from 'teleprompter-sdk';

const client = new Teleprompter.HTTP('https://api.example.com');

// List all prompts
const prompts = await client.listPrompts();

// Retrieve a prompt's latest version
const prompt = await client.getPrompt('welcome-email');

// Update or create a prompt
await client.writePrompt({ id: 'welcome-email', prompt: 'Welcome, {{name}}!' });

// Roll back a prompt to a previous version
await client.rollbackPrompt('welcome-email', 3);
```

#### Advanced: Using a Fetcher Binding

If you're running in an environment like Cloudflare Workers, you can pass a custom `Fetcher` (usually a service binding or mock object) to abstract the request layer:

```ts
const client = new Teleprompter.HTTP(env.API);
```

---

### Rendering Prompts from KV

The `KV` client allows you to fetch templates from a Cloudflare KV namespace and render them directly with runtime context using Mustache.

```ts
const kv = new Teleprompter.KV(env);
const output = await kv.render('welcome-email', { name: 'Ada' });
```

This looks up the `welcome-email` prompt template in the `PROMPTS` namespace and renders it with the supplied context, returning the final text. This is ideal for edge/serverless workloads.

---

## Scripts

- `npm run build` – Compile TypeScript source
- `npm test` – Run unit tests
- `npm run docs` – Generate TypeDoc documentation to the `docs/` folder

Continuous integration automatically runs `npm test` on every pull request.

Before generating docs, ensure that a Git remote named `origin` points to the repository so source links work correctly. You can set this with:

```bash
git remote add origin https://github.com/britt/teleprompter-sdk.git
```

---

## Development

Install dependencies with `npm install` and then run the scripts above as needed.

---

## Summary

- Use the HTTP client (`Teleprompter.HTTP`) to programmatically manage, version, and fetch prompts from a remote API.
- Use the KV client (`Teleprompter.KV`) to quickly render prompts stored in (and distributed by) Cloudflare Workers KV.
- The SDK is designed for performance, transparency, and flexibility in modern LLM-powered applications.
