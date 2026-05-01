# ADR-003: Transpile to TypeScript, execute via Bun

> **Status**: Accepted

## Context
Need a runtime execution strategy. Options: interpret AST directly, compile to bytecode and run on VM, transpile to JS/TS and use existing runtime, or self-host.

## Decision
Transpile to TypeScript and execute via Bun. Rationale: gives instant access to npm ecosystem, Bun is fast for startup and execution, source maps map runtime errors back to .kapy source lines. Cached in .kapy-cache/ with content-hash invalidation. This is the Python model: source-of-truth is .kapy, compilation is invisible, `kapy run` just works.

## Consequences
- (to be determined)

## Alternatives Considered
Direct AST interpretation, bytecode VM, native compilation, self-hosted

## References
- Created: 2026-05-01

## See Also
- [[index]]
