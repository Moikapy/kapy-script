# kapy-script

The AI-native programming language. A `@moikapy/kapy` CLI extension.

## Install

```bash
# Install the kapy CLI (if you haven't)
bun install -g @moikapy/kapy

# Install kapy-script as a kapy extension
kapy install @kapy/script
```

## Usage

```bash
# Create a new project
kapy init my-project
cd my-project

# Run it
kapy run src/main.kapy

# Type-check only
kapy check src/main.kapy

# Run tests
kapy test

# Watch mode (re-run on change)
kapy run --watch src/main.kapy

# Interactive REPL
kapy repl
```

## The Language

kapy-script is a programming language designed for AI agent authorship — but clean enough for anyone.

```kapy
fn greet
  input name: string
  output string
  "Hello, {name}!"
```

### Key features

- **Token-efficient** — 25-35% fewer tokens than equivalent TypeScript
- **Error-resistant** — No braces mismatch, no semicolons, no async/await
- **Contract-first** — Every function declares `input` and `output`
- **AI built-ins** — `llm()`, `embed()`, and `tool` are first-class
- **TypeScript interop** — Transpiles to clean TS, runs on Bun
- **Result type** — `Result[T, E]` with `?` and `!` unwrap operators

### Examples

```kapy
# Sealed traits (ADTs)
sealed trait Result
  case Ok(value: any)
  case Err(message: string)

# Pattern matching
fn classify
  input x: number
  output string
  if x > 0
    "positive"
  else
    "non-positive"

# AI agent
agent ResearchAgent
  input query: string
  output Report

  tools
    search_web, read_document

  steps
    think("Plan research for {query}") -> plan
    search_web(query) -> results
    return results

# Tests
test "addition works"
  1 + 1 == 2
```

## Architecture

```
.kapy source
    ↓
Lexer (indentation-aware tokenization)
    ↓
Parser (recursive descent → typed AST)
    ↓
Type Checker (local inference, ADTs, structural compatibility)
    ↓
Emitter (AST → readable TypeScript)
    ↓
Bun runtime (execute)
```

## Project Structure

```
kapy-script/
  src/
    lexer/          # Tokenization
    parser/         # AST construction
    typechecker/    # Type inference and checking
    transpiler/     # TypeScript emission + caching
    runtime/        # @kapy/runtime (Result, llm, embed, mocks)
    extension/      # kapy CLI extension (commands)
  test/             # 150 tests, 290 assertions
  examples/         # Sample .kapy programs
```

## Extension Commands

| Command | Description |
|---------|-------------|
| `kapy run <file>` | Compile and execute |
| `kapy run --watch <file>` | Re-run on file changes |
| `kapy check <file>` | Parse and type-check |
| `kapy test [path]` | Run test declarations |
| `kapy init <name>` | Scaffold new project |
| `kapy repl` | Interactive REPL |

## Runtime: @kapy/runtime

The transpiled TypeScript imports from `@kapy/runtime`:

- `Result[T, E]` — Ok/Err with unwrap operators
- `llm()` — Provider-agnostic LLM calls
- `embed()` — Vector embeddings
- `print()` — Console output
- `mock_llm()`, `mock_embed()`, `mock_tool()` — Test doubles

## License

MIT