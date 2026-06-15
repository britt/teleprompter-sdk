# Teleprompter SDK

Teleprompter SDK is a TypeScript/JavaScript client library that enables developers to work with prompt management APIs and infrastructure provided by the Teleprompter platform. The SDK offers utilities to interact with Teleprompter APIs either over HTTP or by fetching and rendering prompt templates stored directly in a Cloudflare KV namespace, making it suitable for backend as well as edge/serverless environments.

## Concepts

### Dotprompt format
Prompts may use dotprompt format: a YAML frontmatter block followed by a Handlebars template body. The template body remains Mustache compatible for variable interpolation. Frontmatter may define `model`, `config`, `input`, `output`, `tools`, `description`, and `ext` metadata.

Plain templates without frontmatter remain fully supported. `parseDotprompt()` returns empty metadata and the full source as the template when a prompt does not include frontmatter.

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

The parser accepts empty frontmatter and handles LF and CRLF line endings. `validateDotprompt()` detects malformed frontmatter before storage or publication. If frontmatter parsing fails, the SDK still removes the frontmatter block before rendering so YAML never appears in rendered prompt output.

### Immutable updates
- Prompts are versioned and append-only. Each write creates a new version; existing versions never change.
- You can list a prompt’s history with `getPromptVersions(id)` and target a prior version with `rollbackPrompt(id, version)`.
- This model preserves auditability and makes rollbacks predictable.

### Versioning system
- Each prompt version is the UNIX timestamp (UTC) at the moment the version is created.
- Versions increase over time for a given prompt.
- Versions are assigned automatically by the service; clients do not choose version numbers.

### Update messaging
- For queue workflows, publish updates with `Teleprompter.UpdateMessage({ id, prompt, version, metadata })` and deletions with `Teleprompter.DeleteMessage(id)`.
- `Teleprompter.Prompt` may include optional `metadata` extracted from dotprompt frontmatter.
- A queue consumer applies changes by calling `Teleprompter.HandleUpdates(batch, env, ctx)`, which preserves prompt metadata when it writes updates to the `PROMPTS` KV namespace or deletes keys.
- Running applications that read from KV see the latest prompt on their next fetch; no restart is required.

```ts
// Publish an update
const msg = Teleprompter.UpdateMessage({
  id: 'welcome-email',
  prompt: '---\nmodel: anthropic/claude-sonnet-4-20250514\n---\nWelcome, {{name}}!',
  version: 1731166505, // UNIX timestamp (UTC)
  metadata: {
    model: 'anthropic/claude-sonnet-4-20250514'
  }
})
await queue.send(msg)

// Apply updates in a Worker queue consumer
export default {
  async queue(batch, env, ctx) {
    await Teleprompter.HandleUpdates(batch, env, ctx)
  }
}
```

### Caching
- The KV client reads prompt data by ID and renders the template at the edge for low latency.
- Cloudflare KV is eventually consistent; updates propagate quickly but are not instantaneous. Design caches to tolerate brief propagation delays.
- If you add an application cache, key entries by `id` and `version`. Evict or refresh when a newer version is written. The SDK does not add an extra in-memory cache.

## Clients

The library exposes two primary client types, targeting different use cases and environments:

### 1. HTTP Client
The `HTTP` client is designed to interact with a Teleprompter REST API server. It provides methods to list, read, update, and version prompt templates managed by your service. The API is intended for situations where you have a remote prompt registry or require centralized management (for example, enterprise APIs or development/CI/CD environments).

#### When should you use the HTTP client?
- When you want to remotely manage, version, and audit your LLM prompt templates.
- If you are consuming prompts from an API that tracks prompt history and provides workflow integrations.
- In backend services, CI pipelines, or anywhere you want programmatic access to Teleprompter's HTTP API.

### 2. KV Client
The `KV` client wraps access to a Cloudflare KV namespace that stores prompt templates. It is focused on scenarios where you want fast serverless environment interpolation and rendering. `KV.render()` strips dotprompt frontmatter before Mustache rendering and returns only the rendered template text. This behavior supports dotprompt templates and preserves the existing result for plain templates.

#### When should you use the KV client?
- When deploying prompt templates for use in Cloudflare Workers, edge runtimes, or similar environments.
- For fast rendering of prompts with runtime data.
- As a companion to the HTTP registry: prompts may be published from HTTP to KV for global, performant access.

This dual-client approach gives you flexibility to manage, distribute, and consume LLM prompts in a way that matches your architecture and runtime needs.

---

## Installation

```bash
bun add teleprompter-sdk
# or
npm install teleprompter-sdk
```

---

## Documentation

Full API documentation is available at [https://britt.github.io/teleprompter-sdk/](https://britt.github.io/teleprompter-sdk/)

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
await client.rollbackPrompt('welcome-email', 1731166505); // UNIX timestamp (UTC)
```

#### Advanced: Using a Fetcher Binding

If you're running in an environment like Cloudflare Workers, you can pass a custom `Fetcher` (usually a service binding or mock object) to abstract the request layer:

```ts
const client = new Teleprompter.HTTP(env.API);
```

---

### Rendering Prompts from KV

The `KV` client allows you to fetch templates from a Cloudflare KV namespace and render them directly with runtime context using Mustache. If the stored template includes dotprompt frontmatter, `render()` strips it before rendering and returns only the rendered template text. Plain templates continue to render without any behavior change.

```ts
const kv = new Teleprompter.KV(env);
const output = await kv.render('welcome-email', { name: 'Ada' });
```

This looks up the `welcome-email` prompt template in the `PROMPTS` namespace, removes any frontmatter, and renders the template body with the supplied context. This is ideal for edge/serverless workloads.

---

### Parser Utilities

The SDK exports `parseDotprompt()` and `validateDotprompt()` for working with dotprompt sources directly.

```ts
import { parseDotprompt, validateDotprompt } from 'teleprompter-sdk'

// Parse a dotprompt source into source, metadata, and template
const parsed = parseDotprompt(`---
model: anthropic/claude-sonnet-4-20250514
description: Welcome message
---
Welcome, {{name}}!`)

console.log(parsed.source)
console.log(parsed.metadata.model)
console.log(parsed.template)

// Validate frontmatter before writing
const validation = validateDotprompt(`---
model: anthropic/claude-sonnet-4-20250514
output:
  format: json
---
Welcome, {{name}}!`)

if (!validation.valid) {
  console.error(validation.error)
}
```

`parseDotprompt(source)` returns `{ source, metadata, template }`. It preserves the original source, extracts supported metadata fields, and returns only the template body for rendering. For plain templates without frontmatter, it returns empty metadata and the full source as the template.

`validateDotprompt(source)` returns `{ valid, error? }`. It accepts empty frontmatter, rejects malformed YAML, and rejects frontmatter values that are not key value objects.

#### Metadata related public types

- `PromptMetadata` describes the optional metadata fields that the SDK extracts from dotprompt frontmatter and stores with a prompt.
- `ParsedDotprompt` describes the parsed result returned by `parseDotprompt()`, including the original source, extracted metadata, and template body.
- `ValidationResult` describes the validation result returned by `validateDotprompt()`, including whether the source is valid and any validation error.

---

## Scripts

- `bun run build` – Compile TypeScript source
- `bun test` – Run unit tests
- `bun test --coverage` – Run tests with coverage report
- `bun run docs` – Generate TypeDoc documentation to the `docs/` folder

Continuous integration runs `bun test`, `bun test --coverage`, and `bun run build` on every pull request. The coverage threshold is set to 85% line coverage in `bunfig.toml`, and the GitHub Actions workflow enforces that threshold by running the coverage command during CI.

---

## Development

This project uses [Bun](https://bun.sh) as its runtime and package manager.

Install dependencies:
```bash
bun install
```

Run tests:
```bash
bun test
```

Run coverage:
```bash
bun test --coverage
```

The coverage command must meet the 85% line coverage threshold defined in `bunfig.toml`.

Generate documentation:
```bash
bun run docs
```

Documentation is automatically published to GitHub Pages from the `docs/` directory.

---

## Co-authors

- [doc.holiday](https://doc.holiday)

---

## License

This project is licensed under the [MIT License](./LICENSE).
