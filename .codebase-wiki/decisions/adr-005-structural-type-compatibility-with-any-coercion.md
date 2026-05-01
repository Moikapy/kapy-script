# ADR-005: Structural type compatibility with any coercion

> **Status**: Accepted

## Context
Need a type compatibility system. Options: nominal (by declaration name), structural (by shape), or gradual typing with subtyping.

## Decision
Structural equality with 'any' as a universal supertype. Two types are compatible if they have the same shape (same kind, same fields/params). 'any' accepts any type and is accepted by any type. Array and generic types recurse into their element type argument arrays. This is simple for v0.1, matches TypeScript's structural philosophy, and is trivial for AI agents to understand: 'any means no type checking here'.

## Consequences
- (to be determined)

## Alternatives Considered
Nominal typing, Go-style interfaces, TypeScript full subtyping, gradual typing

## References
- Created: 2026-05-01

## See Also
- [[type-checker]] — Implementation
- [[kapy-script]] — Language overview
