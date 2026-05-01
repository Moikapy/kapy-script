# Codebase Wiki Schema

This wiki documents the kapy-script project — a programming language designed for AI agent authorship that transpiles to TypeScript and runs on Bun.

## Entity Types
- `module` — Source code modules (lexer, parser, transpiler, runtime, CLI)
- `concept` — Cross-cutting ideas (indentation parsing, ADTs, token efficiency, source maps)
- `language-feature` — Documented language features from the design spec
- `milestone` — Implementation phases from the roadmap

## Conventions
- File references use project-relative paths (e.g., `src/lexer/lexer.ts`)
- Version gates tag features: `v0.1`, `v0.5`, `v1.0`
- All pages reference the design spec and implementation plan

## Ingest Rules
- Source: git commits, src/ tree, design-spec.md, implementation-plan.md
- Update pages when files change
- Flag stale pages when they reference code that no longer exists