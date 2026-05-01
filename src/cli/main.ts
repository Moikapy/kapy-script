#!/usr/bin/env bun
// Kapy-script CLI — Phase 2: Lexer + Parser + Type Checker
// Supports: check, repl, --version, --help

import { readFileSync } from "fs";
import * as readline from "readline";
import { Lexer, LexError } from "../lexer";
import { Parser, ParseError, formatParseError } from "../parser";
import { TypeChecker } from "../typechecker";
import { formatTypeError } from "../typechecker/errors";

const VERSION = "0.1.0";

function printHelp(): void {
  console.log(`
kapy v${VERSION} — A programming language designed for AI agent authorship

Usage:
  kapy check <file>    Parse and type-check a .kapy file
  kapy repl            Start interactive REPL
  kapy --version       Print version
  kapy --help          Print this help

Commands:
  check     Parse and type-check a .kapy file
  repl      Start an interactive read-eval-print loop
`);
}

function printVersion(): void {
  console.log(`kapy v${VERSION}`);
}

function runCheck(filePath: string): void {
  let source: string = "";
  try {
    source = readFileSync(filePath, "utf-8");
  } catch {
    console.error(`Error: Cannot read file '${filePath}'`);
    process.exit(1);
  }

  // Phase 1: Lexing
  let tokens;
  try {
    const lexer = new Lexer(source, filePath);
    tokens = lexer.tokenize();
  } catch (error) {
    if (error instanceof LexError) {
      console.error(formatParseError(error as ParseError, source));
      process.exit(1);
    }
    throw error;
  }

  // Phase 2: Parsing
  let ast;
  try {
    const parser = new Parser(tokens, filePath);
    ast = parser.parse();
  } catch (error) {
    if (error instanceof ParseError) {
      console.error(formatParseError(error, source));
      process.exit(1);
    }
    throw error;
  }

  // Phase 3: Type Checking
  const checker = new TypeChecker();
  checker.setFile(filePath);
  const typeErrors = checker.check(ast);

  if (typeErrors.length > 0) {
    for (const error of typeErrors) {
      console.error(formatTypeError(error, source));
    }
    process.exit(1);
  }

  const declCount = ast.declarations.length;
  console.log(`✓ Type-checked successfully (${declCount} declaration${declCount !== 1 ? "s" : ""}, 0 errors)`);
}

function startRepl(): void {
  console.log(`kapy v${VERSION} — Type :help for commands`);

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

    // REPL commands
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

    // Detect block start
    const blockStarters = /\b(fn|agent|tool|if|else|for|while|match|sealed\s+trait|trait|impl|test|parallel|with)\b.*$/;
    if (blockStarters.test(trimmed) && !trimmed.includes("->")) {
      inBlock = true;
      rl.setPrompt(". ");
    } else if (inBlock && trimmed === "") {
      inBlock = false;
      rl.setPrompt("> ");
    } else if (!inBlock) {
      // Try to parse immediately
    }

    // If not in a block, try parsing the buffer
    if (!inBlock && buffer.trim()) {
      tryParse(buffer);
      buffer = "";
    }

    rl.prompt();
  });

  rl.on("close", () => {
    console.log("\nBye! 🐉");
    process.exit(0);
  });
}

function tryParse(source: string): void {
  try {
    const lexer = new Lexer(source, "<repl>");
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens, "<repl>");
    const ast = parser.parse();

    // Type check
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