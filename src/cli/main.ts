#!/usr/bin/env bun
// Kapy-script CLI — Phase 3: Full pipeline with execution
// Supports: run, check, repl, --version, --help

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, join, dirname } from "path";
import { Lexer, LexError } from "../lexer";
import { Parser, ParseError, formatParseError } from "../parser";
import { TypeChecker } from "../typechecker";
import { formatTypeError } from "../typechecker/errors";
import { Emitter } from "../transpiler/emitter";
import { Cache } from "../transpiler/cache";

const VERSION = "0.1.0";

function printHelp(): void {
  console.log(`
kapy v${VERSION} — A programming language designed for AI agent authorship

Usage:
  kapy run <file>      Compile and execute a .kapy file
  kapy check <file>    Parse and type-check a .kapy file
  kapy repl            Start interactive REPL
  kapy --version       Print version
  kapy --help          Print this help

Commands:
  run       Compile and execute a .kapy file via Bun
  check     Parse and type-check a .kapy file
  repl      Start an interactive read-eval-print loop
`);
}

function printVersion(): void {
  console.log(`kapy v${VERSION}`);
}

// ── Full Pipeline ──

function compile(source: string, filePath: string): { code: string; sourceMap: string; ast: any } {
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

function runFile(filePath: string): void {
  const absolutePath = resolve(filePath);
  let source: string;
  try {
    source = readFileSync(absolutePath, "utf-8");
  } catch {
    console.error(`Error: Cannot read file '${filePath}'`);
    process.exit(1);
  }

  // Check cache
  const cache = new Cache(join(dirname(absolutePath), ".kapy-cache"));
  const cachedPath = cache.getCachedTsPath(absolutePath, source);

  let tsCode: string;

  if (cachedPath && existsSync(cachedPath)) {
    tsCode = readFileSync(cachedPath, "utf-8");
  } else {
    try {
      const result = compile(source, absolutePath);
      tsCode = result.code;

      // Cache the output
      const entry = cache.set(absolutePath, source, tsCode);

      // Write source map alongside
      writeFileSync(entry.tsPath + ".map", result.sourceMap, "utf-8");
    } catch (error) {
      if (error instanceof LexError || error instanceof ParseError) {
        console.error(formatParseError(error as any, source));
        process.exit(1);
      }
      throw error;
    }
  }

  // Execute via Bun
  try {
    const cacheEntry = cache.set(absolutePath, source, tsCode);
    const tsPath = cacheEntry.tsPath;
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
      console.error(formatParseError(error as any, source));
      process.exit(1);
    }
    if (error instanceof Error && error.message.includes("process.exit")) {
      // Type check errors already printed
      return;
    }
    throw error;
  }
}

function startRepl(): void {
  console.log(`kapy v${VERSION} — Type :help for commands`);

  const readline = require("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "> ",
  });

  rl.prompt();

  let buffer = "";
  let inBlock = false;

  rl.on("line", (line: string) => {
    const trimmed = line.trim();

    if (!inBlock && trimmed.startsWith(":")) {
      switch (trimmed) {
        case ":help":
          console.log("  :help      Show this help");
          console.log("  :quit      Exit REPL");
          console.log("  :type <expr>  Show inferred type (experimental)");
          break;
        case ":quit":
          rl.close();
          return;
        default:
          console.log(`  Unknown command: ${trimmed}`);
      }
      rl.prompt();
      return;
    }

    buffer += (buffer ? "\n" : "") + line;

    const blockStarters = /\b(fn|agent|tool|if|else|for|while|match|sealed\s+trait|trait|impl|test|parallel|with)\b.*$/;
    if (blockStarters.test(trimmed) && !trimmed.includes("->")) {
      inBlock = true;
      rl.setPrompt(". ");
    } else if (inBlock && trimmed === "") {
      inBlock = false;
      rl.setPrompt("> ");
    }

    if (!inBlock && buffer.trim()) {
      tryEval(buffer);
      buffer = "";
    }

    rl.prompt();
  });

  rl.on("close", () => {
    console.log("\nBye! 🐉");
    process.exit(0);
  });
}

function tryEval(source: string): void {
  try {
    const tokens = new Lexer(source, "<repl>").tokenize();
    const ast = new Parser(tokens, "<repl>").parse();

    const checker = new TypeChecker();
    const typeErrors = checker.check(ast);
    const typeErrorCount = typeErrors.length;

    if (ast.declarations.length > 0) {
      const names = ast.declarations.map(d => {
        if (d.kind === "FnDecl") return `fn ${d.name}`;
        if (d.kind === "AgentDecl") return `agent ${d.name}`;
        if (d.kind === "SealedTraitDecl") return `sealed trait ${d.name}`;
        if (d.kind === "TraitDecl") return `trait ${d.name}`;
        if (d.kind === "ImplDecl") return `impl ${d.trait_name} for ${d.for_name}`;
        if (d.kind === "TestDecl") return `test "${d.name}"`;
        if (d.kind === "ImportDecl") return `import ${d.module.join("/")}`;
        return d.kind;
      });
      console.log(`  Defined: ${names.join(", ")}`);
      if (typeErrorCount > 0) {
        console.log(`  ⚠ ${typeErrorCount} type error(s)`);
      }
    }
  } catch (error) {
    if (error instanceof LexError || error instanceof ParseError) {
      console.error(`  ${error.message}`);
    } else {
      console.error(`  Error: ${error}`);
    }
  }
}

// ── Main ──

const args = process.argv.slice(2);

if (args.length === 0) {
  printHelp();
  process.exit(0);
}

switch (args[0]) {
  case "--help":
  case "-h":
    printHelp();
    break;
  case "--version":
  case "-v":
    printVersion();
    break;
  case "run":
    if (!args[1]) {
      console.error("Error: 'run' requires a file path. Usage: kapy run <file>");
      process.exit(1);
    }
    runFile(args[1]);
    break;
  case "check":
    if (!args[1]) {
      console.error("Error: 'check' requires a file path. Usage: kapy check <file>");
      process.exit(1);
    }
    runCheck(args[1]);
    break;
  case "repl":
    startRepl();
    break;
  default:
    console.error(`Error: Unknown command '${args[0]}'. Run 'kapy --help' for usage.`);
    process.exit(1);
}