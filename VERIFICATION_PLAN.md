# Verification Plan

## Prerequisites

- Bun runtime installed (`bun --version` succeeds)
- All dependencies installed (`bun install` succeeds)
- The `dotprompt` and `yaml` packages are in `node_modules/`
- No running server required — all verification is local

## Scenarios

### Scenario 1: Parser handles real dotprompt sources correctly

**Context**: `src/parser.ts` exists and exports `parseDotprompt` and `validateDotprompt`.

**Steps**:
1. Create a temporary script that imports `parseDotprompt` from the source and parses a full dotprompt with model, config, input/output schemas, tools, and description
2. Run it with `bun` and inspect the returned `metadata` and `template` fields
3. Parse a plain template (no frontmatter) and verify backward compatibility
4. Parse a dotprompt with empty frontmatter (`---\n---\ntemplate`)
5. Parse a dotprompt with CRLF line endings
6. Call `validateDotprompt` on malformed YAML and verify it returns `{ valid: false }` with an error message
7. Call `validateDotprompt` on a YAML scalar frontmatter (`---\njust a string\n---\n`) and verify rejection

**Success Criteria**:
- [ ] Full dotprompt: `metadata.model` equals the model string from frontmatter
- [ ] Full dotprompt: `metadata.config` contains the config object from frontmatter
- [ ] Full dotprompt: `metadata.input.schema` and `metadata.output.schema` are populated
- [ ] Full dotprompt: `template` contains only the body after the closing `---`, no YAML
- [ ] Plain template: `metadata` is `{}` and `template` equals the original source
- [ ] Empty frontmatter: `metadata` is `{}` and `template` is the body after `---\n---\n`
- [ ] CRLF: parser extracts metadata and template correctly
- [ ] Malformed YAML: `validateDotprompt` returns `{ valid: false }` with a truthy `error`
- [ ] Scalar YAML: `validateDotprompt` returns `{ valid: false }`

**If Blocked**: If `dotprompt` npm package API has changed, check `node_modules/dotprompt` for actual exports and ask developer for help.

---

### Scenario 2: Prompt type accepts metadata

**Context**: `src/index.ts` exports the `Teleprompter` namespace with an updated `Prompt` interface.

**Steps**:
1. Create a temporary script that imports `Teleprompter` from the SDK source
2. Construct a `Teleprompter.Prompt` object without `metadata` and verify it compiles and runs
3. Construct a `Teleprompter.Prompt` object with `metadata: { model: 'test', config: { temperature: 0.5 } }` and verify it compiles and runs
4. Verify `PromptMetadata`, `ParsedDotprompt`, and `ValidationResult` are importable from the SDK entry point

**Success Criteria**:
- [ ] A `Prompt` without `metadata` is valid (backward compatible)
- [ ] A `Prompt` with `metadata` is valid and the field is accessible
- [ ] `PromptMetadata`, `ParsedDotprompt`, `ValidationResult` are importable from `src/index.ts`
- [ ] `parseDotprompt` and `validateDotprompt` are importable from `src/index.ts`

**If Blocked**: If TypeScript compilation fails on the new types, check `tsconfig.json` paths and ask developer.

---

### Scenario 3: KV.render() strips frontmatter before rendering

**Context**: The `KV` class's `render()` method should parse the template body out of dotprompt format before passing it to Mustache.

**Steps**:
1. Create a temporary script that constructs a mock KV namespace returning a prompt with dotprompt frontmatter: `---\nmodel: test\n---\nHello {{name}}!`
2. Instantiate `Teleprompter.KV` with that mock
3. Call `kv.render('test-id', { name: 'World' })` and capture the output
4. Repeat with a plain template (no frontmatter): `Hello {{name}}!`
5. Repeat with a complex Mustache template that has frontmatter: `---\nmodel: test\n---\nItems: {{#items}}{{name}}, {{/items}}`

**Success Criteria**:
- [ ] Dotprompt render output is `Hello World!` — no `---` or `model:` in output
- [ ] Plain template render output is `Hello World!` — unchanged behavior
- [ ] Complex template with frontmatter renders items correctly, no frontmatter leaking

**If Blocked**: If Mustache fails on Handlebars-specific syntax (like `{{#role}}`), document the limitation and ask developer whether that's acceptable.

---

### Scenario 4: UpdateMessage and HandleUpdates preserve metadata

**Context**: The `UpdateMessage` function spreads prompt fields into the message. `HandleUpdates` serializes messages to KV with `JSON.stringify`.

**Steps**:
1. Create a `Teleprompter.Prompt` with metadata: `{ model: 'test', config: { temperature: 0.7 } }`
2. Call `Teleprompter.UpdateMessage(prompt)` and inspect the returned message
3. Create a mock KV namespace and a mock MessageBatch containing the update message
4. Call `Teleprompter.HandleUpdates(batch, env, ctx)` and inspect what was passed to `KV.put()`
5. Parse the stored JSON string and verify the metadata is present

**Success Criteria**:
- [ ] `UpdateMessage` output includes `metadata` field alongside `id`, `prompt`, `version`, `type`
- [ ] `HandleUpdates` calls `KV.put()` with a JSON string that, when parsed, contains the `metadata` object
- [ ] A prompt without metadata still works through the same flow (backward compat)

**If Blocked**: If `HandleUpdates` requires Cloudflare-specific types that can't be mocked locally, skip to checking the serialized JSON manually.

---

### Scenario 5: TypeScript build produces valid declarations

**Context**: Running `bun run build` (which invokes `tsc`) should produce declaration files in `dist/` for all new modules.

**Steps**:
1. Run `bun run build`
2. Check that `dist/index.js` exists and contains re-exports for parser and types
3. Check that `dist/index.d.ts` exists and declares `PromptMetadata`, `ParsedDotprompt`, `ValidationResult` types
4. Check that `dist/types.js` and `dist/types.d.ts` exist
5. Check that `dist/parser.js` and `dist/parser.d.ts` exist
6. Verify `dist/index.d.ts` shows `metadata?: PromptMetadata` on the `Prompt` interface

**Success Criteria**:
- [ ] `bun run build` exits with code 0
- [ ] `dist/types.d.ts` exports `PromptMetadata`, `ParsedDotprompt`, `ValidationResult`
- [ ] `dist/parser.d.ts` exports `parseDotprompt` and `validateDotprompt`
- [ ] `dist/index.d.ts` includes `metadata?: PromptMetadata` in the `Prompt` interface
- [ ] `dist/index.js` contains import/re-export of parser module

**If Blocked**: If `tsc` fails on dotprompt package types, check if `@types/dotprompt` is needed or if the package ships its own types.

---

### Scenario 6: Full test suite passes

**Context**: All existing tests still pass, and new tests for types, parser, and metadata flow are green.

**Steps**:
1. Run `bun test`
2. Verify all test files execute: `index.test.ts`, `types.test.ts`, `parser.test.ts`
3. Check that zero tests fail
4. Run `bun test --coverage` and note coverage of `parser.ts` and `types.ts`

**Success Criteria**:
- [ ] `bun test` exits with code 0
- [ ] All existing tests in `index.test.ts` still pass (no regressions)
- [ ] New tests in `types.test.ts` pass
- [ ] New tests in `parser.test.ts` pass
- [ ] No unexpected warnings or deprecation notices

**If Blocked**: If a test fails, check whether it's a regression in existing behavior or a problem with the new code. Ask developer if the expected behavior is unclear.

---

### Scenario 7: Package exports are correct for consumers

**Context**: Consumers install the SDK and import from `teleprompter-sdk`. The `package.json` `main` and `types` fields must point to valid files that export everything needed.

**Steps**:
1. Verify `package.json` `main` points to `./dist/index.js` and it exists
2. Verify `package.json` `types` points to `./dist/index.d.ts` and it exists
3. Create a temporary script outside `src/` that does: `import Teleprompter, { parseDotprompt, validateDotprompt } from './dist/index.js'` and uses each export
4. Run it with `bun` and verify no import errors

**Success Criteria**:
- [ ] Default import (`Teleprompter`) works and `Teleprompter.HTTP`, `Teleprompter.KV`, `Teleprompter.UpdateMessage`, `Teleprompter.DeleteMessage`, `Teleprompter.HandleUpdates` are accessible
- [ ] Named imports `parseDotprompt` and `validateDotprompt` work
- [ ] Type imports `PromptMetadata`, `ParsedDotprompt`, `ValidationResult` resolve (verified by `tsc --noEmit` on the temp script)

**If Blocked**: If named exports fail, check whether `src/index.ts` uses `export { ... }` vs `export * from ...` correctly.

## Verification Rules

- Never use mocks or fakes for verification (test suite mocks are fine — verification scripts must use real parser, real Mustache, real dotprompt library)
- If any success criterion fails, verification fails
- Ask developer for help if blocked, don't guess
