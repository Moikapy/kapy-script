# kapy-script

> The AI-native programming language. Designed for agent authorship, clean enough for anyone.

[![CI](https://github.com/moikapy/kapy-script/actions/workflows/ci.yml/badge.svg)](https://github.com/moikapy/kapy-script/actions)
[![npm: @moikapy/kapy-script](https://img.shields.io/npm/v/@moikapy/kapy-script?label=%40kapy%2Fscript)](https://www.npmjs.com/package/@moikapy/kapy-script)
[![npm: @moikapy/kapy-runtime](https://img.shields.io/npm/v/@moikapy/kapy-runtime?label=%40kapy%2Fruntime)](https://www.npmjs.com/package/@moikapy/kapy-runtime)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

**v0.1** — 239 tests, 0 failures. Production-compiled, designed for humans.

## Install

```bash
# Standalone CLI
npm install -g @moikapy/kapy-script
kapy run hello.kapy

# Or as a @moikapy/kapy extension
bun install -g @moikapy/kapy
kapy install @moikapy/kapy-script
```

## Quick Start

```kapy
fn greet
  input name: string
  output string
  "Hello, {name}!"
```

```bash
kapy init my-project
cd my-project
kapy run src/main.kapy
# → Hello from my-project!
```

## The Language

### Functions (all async)

```kapy
fn add
  input a: number
  input b: number
  output number
  a + b
```

Every function is async. No `await`, no `async` — I/O is implicit.

### Result type

```kapy
result = json.parse('{"key": "value"}')
result?      # Unwrap Ok, propagate Err
result!      # Unwrap Ok, crash on Err
```

### Pattern matching

```kapy
sealed trait Result
  case Ok(value: any)
  case Err(message: string)

match result
  Ok(v) -> v
  Err(e) -> handle_error(e)
```

### Agents

```kapy
agent ResearchAgent
  input query: string
  output Report

  tools
    search_web, read_document

  steps
    search_web(query) -> sources
    return sources
```

### Standard library

```kapy
import kapy/http        # HTTP client (get, post, put, del)
import kapy/fs           # File system (readFile, writeFile, exists)
import kapy/json         # JSON with Result types (parse, stringify)
import kapy/ai           # AI providers (OpenAI, Anthropic, Ollama)
import kapy/ai/chain     # LLM chaining (run, parallel, mapReduce)
import kapy/web/router   # HTTP server (create, get, post, listen)
import kapy/test          # Test assertions (assertEqual, assertTrue, ...)

# Escape braces in strings
text = "\{ \"hello\": 1 \}"
result = json.parse(text)
```

## Commands

| Command | Description |
|---------|-------------|
| `kapy run <file>` | Compile and execute a .kapy file |
| `kapy run --watch <file>` | Re-run on file changes |
| `kapy check <file>` | Parse and type-check |
| `kapy fmt <file>` | Format a .kapy file |
| `kapy fmt --check <file>` | Check formatting |
| `kapy lint <file>` | Lint for common issues |
| `kapy lint --strict <file>` | Treat warnings as errors |
| `kapy test [path]` | Run test declarations |
| `kapy init <name>` | Scaffold a new project |
| `kapy repl` | Interactive REPL |

## Version Features

| Feature | v0.1 ✅ | v0.5 🔜 |
|---------|---------|---------|
| Functions, agents, sealed traits | ✅ | |
| Pattern matching | ✅ | |
| Result type with `?` and `!` | ✅ | |
| Import, print, test | ✅ | |
| HTTP, FS, JSON, AI providers | ✅ | |
| Router, LLM chaining, test assertions | ✅ | |
| Trait method dispatch | | 🔜 |
| Exhaustiveness checking | | 🔜 |
| Union & intersection types | | 🔜 |
| Package manager | | 🔜 |

## Stats

- **37 source files**, ~7,680 lines
- **239 tests**, 467 assertions
- **7 example files** (hello, greet, divide, result, agent, cli-tool, web-api)

## Project Structure

```
src/
  lexer/        Tokenizer (indentation-aware, string interpolation)
  parser/       Recursive descent parser → AST
  typechecker/  Local type inference, ADTs, version-gated warnings
  transpiler/   AST → TypeScript emitter with source maps
  runtime/      @moikapy/kapy-runtime (Result, llm, embed, print, stdlib)
  cli/          Standalone CLI (run, check, test, init, repl, fmt, lint)
  extension/    @moikapy/kapy-script kapy extension
test/           13 test files
examples/       7 .kapy example files
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT — see [LICENSE](./LICENSE).