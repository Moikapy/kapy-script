# Changelog

All notable changes to kapy-script are documented here.

## [0.1.0] — 2026-05-01

### Added

**Phase 1: Lexer & Parser**
- Indentation-based tokenizer (2-space, INDENT/DEDENT tokens)
- Recursive descent parser for all v0.1 syntax
- Error recovery (multi-error reporting)
- String interpolation with `\{` and `\}` escape sequences
- All declaration types: `fn`, `agent`, `tool`, `sealed trait`, `trait`, `impl`, `test`, `import`
- Expression types: if/else, for, while, match, parallel, with, lambda, pipeline (`|>`)
- Pattern matching: identifier, wildcard, literal, destructure patterns

**Phase 2: Type Checker**
- Local type inference (primitive types, function signatures)
- Result type with `?` (unwrap) and `!` (crash-unwrap) operators
- Sealed traits and ADT typechecking
- Structural type compatibility with `any` coercion
- Version-gated warnings for v0.5+ features (traits, impl dispatch, exhaustiveness, parallel)

**Phase 3: Transpiler**
- AST → clean TypeScript emitter
- All functions emitted as `async`
- Content-hash based cache (`.kapy-cache/`)
- Source maps with VLQ-encoded line mappings and `sourcesContent`
- `@kapy/runtime` package with subpath exports

**Phase 4: CLI & Runtime**
- `kapy run` — compile and execute
- `kapy run --watch` — re-run on file change
- `kapy check` — parse and type-check
- `kapy test` — discover and run test declarations via Bun
- `kapy init` — scaffold a new project
- `kapy repl` — interactive REPL
- `kapy fmt` — code formatter (string-aware, indent-normalizing)
- `kapy lint` — lint for unused vars, missing output types, empty bodies
- `kapy.pkg` project manifest parsing
- `@kapy/script` extension for `@moikapy/kapy` CLI

**Phase 5: Standard Library**
- `kapy/http` — get, post, put, del (fetch wrapper with Result types)
- `kapy/fs` — readFile, writeFile, exists, listDir, readJson, writeJson
- `kapy/json` — parse, stringify, unsafeParse, unsafeStringify (Result-based)
- `kapy/ai` — OpenAI, Anthropic, Ollama adapters with `chat()` and provider config
- `kapy/ai/chain` — sequential `run()`, `parallel()`, `mapReduce()` LLM chains
- `kapy/web/router` — create(), get/post/put/delete, json/text/html/redirect, parseParams
- `kapy/test` — assertEqual, assertTrue, assertFalse, assertOk, assertErr, assertThrows, assertApprox, assertContains, assertLength

**Phase 6: Polish**
- 7 example files (hello, greet, divide, result, agent, cli-tool, web-api)
- Getting started documentation
- Mock system (mock_llm, mock_embed, mock_tool) for testing
- Bug fixes for lexer, parser, type checker, emitter

### Known Limitations (v0.1)

- **Trait method dispatch** — `trait` declarations are allowed but dispatch is structural. Full trait resolution requires v0.5+.
- **Exhaustiveness checking** — Non-exhaustive match expressions produce a warning. Full checking at v0.5+.
- **Union and intersection types** — Not yet supported.
- **Package manager** — No `kapy pkg install`/`publish` yet.
- **Watch mode** — May have edge cases with complex imports.
- **LSP/IDE support** — Not yet available.
- **`import kapy/test`** — Works via keyword-as-identifier in import paths.
- **Source maps** — VLQ line mappings work; column mappings not yet implemented.
- **Formatter** — String-aware regex-based. Not AST-aware.

### Stats

- **37 source files**, ~7,680 lines of TypeScript
- **239 tests**, 467 assertions, 0 failures
- **7 example files**, all pass type-check and run