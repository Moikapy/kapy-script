# kapy-script — Getting Started

## Install

```bash
# Install the kapy CLI framework
bun install -g @moikapy/kapy

# Add kapy-script as an extension
kapy install @kapy/script
```

## Commands

| Command | Description |
|---------|-------------|
| `kapy run <file>` | Compile and execute a .kapy file |
| `kapy run --watch <file>` | Re-run on file changes |
| `kapy check <file>` | Parse and type-check a .kapy file |
| `kapy fmt <file>` | Format a .kapy file |
| `kapy fmt --check <file>` | Check if file needs formatting |
| `kapy lint <file>` | Lint for common issues |
| `kapy lint --strict <file>` | Treat warnings as errors |
| `kapy test [path]` | Run test declarations |
| `kapy init <name>` | Scaffold a new project |
| `kapy repl` | Interactive REPL |
| `kapy --version` | Print version |
| `kapy --help` | Print help |

## Hello World

```kapy
fn main
  print("Hello, kapy-script!")
```

```bash
kapy run hello.kapy
# → Hello, kapy-script!
```

## Language Reference

### Functions

```kapy
fn greet
  input name: string
  output string
  "Hello, {name}!"
```

### Variables

```kapy
x = 42        # immutable
y := x + 1    # mutable (note the :=)
```

### Control Flow

```kapy
if x > 0
  "positive"
else
  "non-positive"

for item in items
  print(item)

while count > 0
  count = count - 1
```

### Pattern Matching

```kapy
sealed trait Result
  case Ok(value: any)
  case Err(message: string)

match result
  Ok(v) -> v
  Err(e) -> handle_error(e)
```

### Error Handling

```kapy
result = risky_operation()
result?      # Unwrap Ok, propagate Err
result!     # Unwrap Ok, crash on Err
```

### Agents

```kapy
agent ResearchAgent
  input query: string
  output Report

  tools
    search_web
    read_document

  steps
    search_web(query) -> sources
    return sources
```

### Imports

```kapy
import kapy/http       # HTTP client
import kapy/fs          # File system
import kapy/json        # JSON with Result types
import kapy/ai          # AI providers (OpenAI, Anthropic, Ollama)
import kapy/ai/chain    # LLM chaining (sequential, parallel, map-reduce)
import kapy/web/router  # HTTP server (create, get, post, etc.)
import kapy/test         # Test assertions

# Escape braces in strings with \{ and \}
json_text = "\{ \\\"hello\\\": 1 \}"
result = json.parse(json_text)
```

## Standard Library

| Module | Key Exports | Description |
|--------|-------------|-------------|
| `@kapy/runtime` | `Result`, `Ok`, `Err`, `llm`, `embed`, `print`, `mock_llm`, `mock_embed` | Core runtime |
| `kapy/http` | `get`, `post`, `put`, `del` | HTTP client (fetch wrapper) |
| `kapy/fs` | `readFile`, `writeFile`, `exists`, `listDir`, `readJson`, `writeJson` | File system |
| `kapy/json` | `parse`, `stringify`, `unsafeParse`, `unsafeStringify` | JSON with Result types |
| `kapy/ai` | `chat`, `openaiChat`, `anthropicChat`, `ollamaChat` | LLM providers |
| `kapy/ai/chain` | `run`, `parallel`, `mapReduce` | LLM chaining |
| `kapy/web/router` | `create`, `json`, `text`, `html`, `redirect`, `parseParams` | HTTP server |
| `kapy/test` | `assertEqual`, `assertTrue`, `assertFalse`, `assertOk`, `assertErr`, `assertThrows`, `assertApprox`, `assertContains`, `assertLength` | Test assertions |

## Project Scaffolding

```bash
kapy init my-project
cd my-project
bun install    # Install @kapy/runtime
kapy run src/main.kapy
kapy test
```

Creates:

```
my-project/
  kapy.pkg
  package.json
  .gitignore
  README.md
  .kapy-cache/
  src/main.kapy
  test/main.test.kapy
```

## Running Tests

```bash
kapy test              # Run all tests
kapy test path/to/dir  # Run tests in a directory
```

Test declarations use Bun's test runner:

```kapy
test "addition works"
  1 + 1 == 2
```

With assertions:

```kapy
import kapy/test

test "json parsing"
  result = json.parse("\{ \\\"hello\\\": 1 \}")
  assertOk(result)
  assertEqual(result.value, 1)
```

## Version Features

| Feature | Version |
|---------|---------|
| Functions, agents, sealed traits, pattern matching | v0.1 ✅ |
| Import, test, print, Result type | v0.1 ✅ |
| HTTP, filesystem, JSON, AI providers | v0.1 ✅ |
| HTTP router, LLM chaining, test assertions | v0.1 ✅ |
| Trait method resolution | v0.5 🔜 |
| Exhaustiveness checking | v0.5 🔜 |
| Union and intersection types | v0.5 🔜 |
| Package manager (install/publish) | v0.5 🔜 |

## License

MIT