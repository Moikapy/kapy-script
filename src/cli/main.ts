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
import { watchAndRun } from "./watch";

const VERSION = "0.1.0";

function printHelp(): void {
  console.log(`
kapy v${VERSION} — A programming language designed for AI agent authorship

Usage:
  kapy run <file>        Compile and execute a .kapy file
  kapy run --watch <file> Re-run on file changes
  kapy check <file>      Parse and type-check a .kapy file
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
  if (typeErrors.length > 0) {
    for (const error of typeErrors) {
      console.error(formatTypeError(error, source));
    }
    process.exit(1);
  }

  // Phase 4: Transpile
  const emitter = new Emitter();
  const { code, sourceMap } = emitter.emit(ast);

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

    const proc = Bun.spawnSync(["bun", "run", tsPath], {
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
      env: {
        ...process.env,
        NODE_PATH: resolve(__dirname, ".."),
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