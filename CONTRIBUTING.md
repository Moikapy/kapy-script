# Contributing to kapy-script

Thanks for your interest! Here's how to contribute.

## Development Setup

```bash
# Clone and install
git clone https://github.com/moikapy/kapy-script.git
cd kapy-script
bun install

# Run tests
bun test

# Run the CLI locally
bun run src/cli/main.ts run examples/hello.kapy

# Type-check
bun run src/cli/main.ts check examples/hello.kapy
```

## Project Structure

```
src/
  lexer/        — Tokenizer (indentaion-aware, string interpolation, escape sequences)
  parser/        — Recursive descent parser → AST
  typechecker/   — Local type inference, ADTs, error reporting
  transpiler/    — AST → TypeScript emitter with source maps and content-hash cache
  runtime/       — @kapy/runtime (Result, llm, embed, print, mock, stdlib submodules)
  cli/           — Standalone CLI commands (run, check, test, init, repl, fmt, lint)
  extension/     — @kapy/script kapy extension (register + meta exports)
test/            — 13 test files, 239 tests, 467 assertions
examples/        — 7 example .kapy files
docs/            — getting-started.md
```

## Making Changes

1. **Create a branch** — `feat/my-feature` or `fix/my-bug`
2. **Write tests first** — Add tests in `test/` before implementing
3. **Run the suite** — `bun test` must pass with 0 failures
4. **Check examples** — All 7 examples must pass `kapy check`
5. **Commit** — Use conventional commits (`feat:`, `fix:`, `docs:`, `chore:`)

## Code Style

- TypeScript strict mode
- 2-space indentation (no semicolons in .ts)
- Async everywhere (all kapy-script functions are async)
- Error messages point to `.kapy` source locations with actionable suggestions

## Reporting Bugs

Open a GitHub issue with:
- The `.kapy` source that triggers the bug
- The full error output
- What you expected to happen

## Feature Requests

v0.1 scope is frozen. Feature requests for v0.5+ are welcome — just label them `v0.5` or `future`.

## License

MIT — see [LICENSE](./LICENSE)