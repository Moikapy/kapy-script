# ADR-001: Hand-written recursive descent parser

> **Status**: Accepted

## Context
Need a parser for kapy-script. Options: PEG parser generator, hand-written recursive descent, or parser combinator library.

## Decision
Chose hand-written recursive descent. PEG parsers produce poor error messages and are hard to debug. Recursive descent gives full control over error recovery and messaging, which is critical for a language targeting AI agent authorship (good error messages are a core value).

## Consequences
- (to be determined)

## Alternatives Considered
PEG parser generator (Tree-sitter, peggy), parser combinator

## References
- Created: 2026-05-01

## See Also
- [[index]]
