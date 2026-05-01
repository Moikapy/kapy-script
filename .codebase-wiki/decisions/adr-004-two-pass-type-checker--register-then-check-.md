# ADR-004: Two-pass type checker (register then check)

> **Status**: Accepted

## Context
Functions and declarations reference each other. An expression in fn A might call fn B defined later in the file. Forward references need to resolve. Options: single-pass (restrict forward refs), two-pass (register all signatures first, then check bodies), or incremental resolution.

## Decision
Two-pass: first pass registers all top-level declarations (FnDecl, SealedTraitDecl, AgentDecl, ToolDecl) into the type environment. Second pass checks all function bodies. This allows forward references, recursive functions, and mutual recursion naturally. Implementation: registerDeclaration() collects signatures, checkDeclaration() walks bodies.

## Consequences
- (to be determined)

## Alternatives Considered
Single-pass with forward-declaration syntax, multi-pass with arbitrary passes, topological sort of declarations

## References
- Created: 2026-05-01

## See Also
- [[type-checker]] — Implementation
- [[kapy-script]] — Language overview
