# ADR-003: ADR-003: KapyError shared error interface

> **Status**: Accepted

## Context
LexError, ParseError, and TypeCheckError had identical shapes (file, line, column, message) but were separate classes. The CLI needed to format all three with the same formatParseError function, which required 'as any' casts.

## Decision
Created a KapyError interface with file, line, column, message properties. Both LexError and ParseError implement it. TypeCheckError also implements it. formatParseError now accepts KapyError instead of ParseError, eliminating all 'as any' casts in CLI error handling.

## Consequences
- (to be determined)

## Alternatives Considered
- None documented yet

## References
- Created: 2026-05-01

## See Also
- [[index]]
