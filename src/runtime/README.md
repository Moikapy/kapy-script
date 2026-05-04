# @kapy/runtime

Runtime for [kapy-script](https://github.com/moikapy/kapy-script) — the AI-native programming language.

## Install

```bash
bun add @kapy/runtime
```

## Exports

| Import | Description |
|--------|-------------|
| `@kapy/runtime` | Core: Result, Ok, Err, llm, embed, print, mock |
| `@kapy/runtime/mock` | Mock system: mock_llm, mock_embed, mock_tool |
| `@kapy/runtime/http` | HTTP client: get, post, put, del |
| `@kapy/runtime/fs` | File system: readFile, writeFile, exists, ... |
| `@kapy/runtime/json` | JSON with Result: parse, stringify |
| `@kapy/runtime/ai` | AI providers: chat, OpenAI, Anthropic, Ollama |
| `@kapy/runtime/ai/chain` | LLM chaining: run, parallel, mapReduce |
| `@kapy/runtime/web/router` | HTTP server: create, get, post, listen |
| `@kapy/runtime/test` | Assertions: assertEqual, assertTrue, ... |

## Result Type

```ts
import { Ok, Err, type Result } from "@kapy/runtime";

const good: Result<number, string> = Ok(42);
good.unwrap(); // 42
good._tag;      // "Ok"

const bad: Result<number, string> = Err("failed");
bad._tag;       // "Err"
bad.unwrap();   // throws
```

## License

MIT