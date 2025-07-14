# Teleprompter SDK

Teleprompter SDK provides TypeScript helpers for working with the Teleprompter service. It exposes an HTTP client for remote APIs as well as utilities for rendering prompts stored in a Cloudflare KV namespace.

## Installation

```bash
npm install teleprompter-sdk
```

## Usage

### HTTP Client

Create an `HTTP` instance with either a base URL or a `Fetcher` binding. The client implements methods for listing, retrieving and updating prompts.

```ts
import Teleprompter from 'teleprompter-sdk';

const client = new Teleprompter.HTTP('https://api.example.com');
const prompts = await client.listPrompts();
```

### Rendering Prompts from KV

If you have a Cloudflare Workers environment with a `PROMPTS` namespace, the `KV` helper can render stored prompts using Mustache templates.

```ts
const kv = new Teleprompter.KV(env);
const output = await kv.render('welcome-email', { name: 'Ada' });
```

## Scripts

- `npm run build` – compile TypeScript source
- `npm test` – run unit tests
- `npm run docs` – generate TypeDoc documentation to the `docs/` folder

Continuous integration automatically runs `npm test` on every pull request.

Before generating docs, ensure that a Git remote named `origin` points to the repository so source links work correctly. You can set this with:

```bash
git remote add origin https://github.com/britt/teleprompter-sdk.git
```

## Development

Install dependencies with `npm install` and then run the scripts above as needed.
