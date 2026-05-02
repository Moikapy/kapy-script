# kapy-script — Getting Started

## Install

```bash
bun install
```

## Commands

| Command | Description |
|---------|-------------|
| `kapy run <file>` | Compile and execute a .kapy file |
| `kapy run --watch <file>` | Re-execute on file changes |
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
y := x + 1    # mutable
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
import kapy/json       # JSON parse/stringify
import kapy/fs         # File system
import kapy/ai         # AI providers (OpenAI, Anthropic, Ollama)
import { z } from "zod"  # npm packages
```

## Standard Library

| Module | Functions | Description |
|--------|-----------|-------------|
| `kapy/http` | `get`, `post`, `put`, `del` | HTTP client (fetch wrapper) |
| `kapy/fs` | `readFile`, `writeFile`, `exists`, `listDir`, `stat`, `readJson`, `writeJson` | File system operations |
| `kapy/json` | `parse`, `stringify`, `unsafeParse`, `unsafeStringify` | JSON with Result types |
| `kapy/ai` | `chat`, `openaiChat`, `anthropicChat`, `ollamaChat` | LLM provider adapters |
| `@kapy/runtime` | `Result`, `Ok`, `Err`, `llm`, `embed`, `print`, `KapyRuntime` | Core runtime |

## Project Scaffolding

```bash
kapy init my-project
cd my-project
kapy run src/main.kapy
kapy test
```

Creates:
```
my-project/
  kapy.pkg
  package.json
  .gitignore
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

## License

MIT