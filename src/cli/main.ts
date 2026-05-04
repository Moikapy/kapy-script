#!/usr/bin/env bun
// Kapy-script CLI — Phase 4: Full developer experience
// Commands: run, check, test, init, repl, --version, --help

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, join, dirname } from "path";
import { Lexer, LexError } from "../lexer";
import { Parser, ParseError, formatParseError } from "../parser";
import { TypeChecker } from "../typechecker";
import { formatTypeError } from "../typechecker/errors";
import { Emitter } from "../transpiler/emitter";
import { Cache } from "../transpiler/cache";
import { initProject } from "./init";
import { runTests } from "./test-runner";
import { startRepl } from "./repl";
import { formatFile } from "./fmt";
import { lintFile, formatFinding } from "./lint";
import { watchAndRun } from "./watch";

const VERSION = "0.1.0";

function printHelp(): void {
  console.log(`
kapy v${VERSION} — A programming language designed for AI agent authorship

Usage:
  kapy run <file>        Compile and execute a .kapy file
  kapy run --watch <file> Re-run on file changes
  kapy check <file>      Parse and type-check a .kapy file
  kapy fmt <file>        Format a .kapy file
  kapy fmt --check <file> Check if file needs formatting
  kapy lint <file>        Lint a .kapy file
  kapy lint --strict <file> Treat warnings as errors
  kapy test [path]       Run test declarations
  kapy init <name>       Scaffold a new project
  kapy repl              Start interactive REPL
  kapy --version         Print version
  kapy --help            Print this help

Commands:
  run       Compile and execute a .kapy file via Bun
  check     Parse and type-check a .kapy file
  test      Discover and run test declarations
  init      Scaffold a new kapy-script project
  repl      Interactive read-eval-print loop
`);
}

function printVersion(): void {
  console.log(`kapy v${VERSION}`);
}

// ── Full Pipeline ──

export function compile(source: string, filePath: string): { code: string; sourceMap: string; ast: import("../parser/ast").Program } {
  // Phase 1: Lex
  const tokens = new Lexer(source, filePath).tokenize();

  // Phase 2: Parse
  const ast = new Parser(tokens, filePath).parse();

  // Phase 3: Type Check
  const checker = new TypeChecker();
  checker.setFile(filePath);
  const typeErrors = checker.check(ast);
  // Display warnings (non-blocking)
  const warnings = checker.getWarnings();
  for (const warn of warnings) {
    console.error(formatTypeError(warn, source));
  }
  // Display errors (blocking)
  if (typeErrors.length > 0) {
    for (const error of typeErrors) {
      console.error(formatTypeError(error, source));
    }
    process.exit(1);
  }

  // Phase 4: Transpile
  const emitter = new Emitter();
  const { code, sourceMap } = emitter.emit(ast, source);

  return { code, sourceMap, ast };
}

export function runFile(filePath: string): void {
  const absolutePath = resolve(filePath);
  let source: string;
  try {
    source = readFileSync(absolutePath, "utf-8");
  } catch {
    console.error(`Error: Cannot read file '${filePath}'`);
    process.exit(1);
  }

  // Check cache
  const cacheDir = join(dirname(absolutePath), ".kapy-cache");
  const cache = new Cache(cacheDir);
  const cachedPath = cache.getCachedTsPath(absolutePath, source);

  let tsCode: string;
  let tsPath: string;

  if (cachedPath && existsSync(cachedPath)) {
    // Use cached version
    tsCode = readFileSync(cachedPath, "utf-8");
    tsPath = cachedPath;
  } else {
    try {
      const result = compile(source, absolutePath);
      tsCode = result.code;

      // Cache the output
      const entry = cache.set(absolutePath, source, tsCode);
      tsPath = entry.tsPath;

      // Write source map alongside
      writeFileSync(tsPath + ".map", result.sourceMap, "utf-8");
    } catch (error) {
      if (error instanceof LexError || error instanceof ParseError) {
        console.error(formatParseError(error, source));
        process.exit(1);
      }
      throw error;
    }
  }

  // Execute via Bun
  try {
    // Ensure the cache directory and file exist
    mkdirSync(dirname(tsPath), { recursive: true });
    writeFileSync(tsPath, tsCode, "utf-8");

    // Resolve @moikapy/kapy-runtime: prefer project's node_modules, fall back to bundled runtime
    const projectNodeModules = join(resolve("."), "node_modules");
    const runtimePaths = [
      projectNodeModules,                    // project-installed @moikapy/kapy-runtime
      join(dirname(absolutePath), "node_modules"), // near the .kapy file
      resolve(__dirname, ".."),              // bundled runtime (dev)
    ].filter(existsSync);

    const nodePath = runtimePaths.join(":");

    const proc = Bun.spawnSync(["bun", "run", tsPath], {
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
      env: {
        ...process.env,
        NODE_PATH: nodePath,
      },
    });

    if (proc.exitCode !== 0 && proc.exitCode !== null) {
      process.exit(proc.exitCode);
    }
  } catch (error) {
    console.error(`Runtime error: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

function runCheck(filePath: string): void {
  const absolutePath = resolve(filePath);
  let source: string;
  try {
    source = readFileSync(absolutePath, "utf-8");
  } catch {
    console.error(`Error: Cannot read file '${filePath}'`);
    process.exit(1);
  }

  try {
    const result = compile(source, absolutePath);
    const declCount = result.ast.declarations.length;
    console.log(`✓ Type-checked successfully (${declCount} declaration${declCount !== 1 ? "s" : ""}, 0 errors)`);
  } catch (error) {
    if (error instanceof LexError || error instanceof ParseError) {
      console.error(formatParseError(error, source));
      process.exit(1);
    }
    throw error;
  }
}

// ── Main ──

const args = process.argv.slice(2);

if (args.length === 0) {
  printHelp();
  process.exit(0);
}

// Parse flags for run command
let watchMode = false;
let fileToRun: string | null = null;

if (args[0] === "run") {
  // Parse --watch flag
  const runArgs = args.slice(1);
  if (runArgs.includes("--watch") || runArgs.includes("-w")) {
    watchMode = true;
    fileToRun = runArgs.find(a => !a.startsWith("-")) || null;
  } else {
    fileToRun = runArgs[0] || null;
  }

  if (!fileToRun) {
    console.error("Error: 'run' requires a file path. Usage: kapy run [--watch] <file>");
    process.exit(1);
  }

  if (watchMode) {
    watchAndRun(fileToRun, runFile);
    // watchAndRun keeps the process alive
  } else {
    runFile(fileToRun);
  }
} else {
  switch (args[0]) {
    case "--help":
    case "-h":
      printHelp();
      break;
    case "--version":
    case "-v":
      printVersion();
      break;
    case "check":
      if (!args[1]) {
        console.error("Error: 'check' requires a file path. Usage: kapy check <file>");
        process.exit(1);
      }
      runCheck(args[1]);
      break;
    case "test":
      runTests(args[1]);
      break;
    case "fmt":
      if (!args[1] || args[1] === "--help") {
        console.log("Usage: kapy fmt <file> [options]");
        console.log("");
        console.log("Options:");
        console.log("  --check    Check if file needs formatting (exit 1 if changes needed)");
        console.log("  --dry-run  Print formatted output to stdout");
        process.exit(args[1] === "--help" ? 0 : 1);
      }
      {
        const fmtFile = args[1].startsWith("--") ? args[2] : args[1];
        const check = args.includes("--check");
        const dryRun = args.includes("--dry-run");
        if (!fmtFile) {
          console.error("Error: 'fmt' requires a file path. Usage: kapy fmt <file>");
          process.exit(1);
        }
        const result = formatFile(fmtFile, { check, dryRun });
        if (check && result.changed) process.exit(1);
      }
      break;
    case "lint":
      if (!args[1] || args[1] === "--help") {
        console.log("Usage: kapy lint <file> [options]");
        console.log("");
        console.log("Options:");
        console.log("  --strict    Treat warnings as errors (exit 1)");
        process.exit(args[1] === "--help" ? 0 : 1);
      }
      {
        const lintFilePath = args[1].startsWith("--") ? args[2] : args[1];
        const strict = args.includes("--strict");
        if (!lintFilePath) {
          console.error("Error: 'lint' requires a file path. Usage: kapy lint <file>");
          process.exit(1);
        }
        const findings = lintFile(lintFilePath, { strict });
        for (const finding of findings) {
          console.log(formatFinding(finding));
        }
        const errorCount = findings.filter(f => f.severity === "error").length;
        const warningCount = findings.filter(f => f.severity === "warning").length;
        if (findings.length === 0) {
          console.log(`✓ No lint issues found in ${lintFilePath}`);
        } else {
          console.log(`\n  ${errorCount} error(s), ${warningCount} warning(s)`);
        }
        if (errorCount > 0 || (strict && findings.length > 0)) {
          process.exit(1);
        }
      }
      break;
    case "init":
      if (!args[1]) {
        console.error("Error: 'init' requires a project name. Usage: kapy init <name>");
        process.exit(1);
      }
      initProject({ name: args[1] });
      break;
    case "repl":
      startRepl();
      break;
    default:
      console.error(`Error: Unknown command '${args[0]}'. Run 'kapy --help' for usage.`);
      process.exit(1);
  }
}