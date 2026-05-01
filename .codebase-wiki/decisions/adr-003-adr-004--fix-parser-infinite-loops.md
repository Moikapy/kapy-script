# ADR-003: ADR-004: Fix parser infinite loops

> **Status**: Accepted

## Context
The parser had 5 infinite loops when encountering unsupported syntax (agent, trait, impl, parallel, with blocks) and unclosed parens. These blocked Phase 5 because the core language features were unusable.

## Decision
Fixed all 5 parser infinite loops. Root cause: synchronize() didn't advance past the error token or DEDENT, causing the top-level loop to re-encounter the same unhandleable token. Fix: (1) synchronize() now calls this.advance() before scanning, (2) DEDENT is consumed and treated as resync point rather than stop point, (3) declaration() skips stray DEDENTs, (4) DEDENT loops have !isAtEnd() guards, (5) stepStatement() handles return statements.

## Consequences
- (to be determined)

## Alternatives Considered
- None documented yet

## References
- Created: 2026-05-01

## See Also
- [[index]]
