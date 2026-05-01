# ADR-003: kapy-script as @kapy/script kapy CLI extension

> **Status**: Accepted

## Context
kapy-script was initially built as a standalone CLI tool. But the author already has @moikapy/kapy — an extensible CLI framework published on npm with the `kapy` binary. Having two separate CLIs would confuse users.

## Decision
Restructure kapy-script as a kapy CLI extension (@kapy/script). Users install the kapy CLI once, then add kapy-script as an extension. Commands like `kapy run`, `kapy check`, `kapy test` become native kapy subcommands. The extension follows the kapy extension API: exports `register(api)` and `meta`. The standalone CLI in src/cli/ is kept for dev/testing but is not the distribution path.

## Consequences
- (to be determined)

## Alternatives Considered
- None documented yet

## References
- Created: 2026-05-01

## See Also
- [[index]]
