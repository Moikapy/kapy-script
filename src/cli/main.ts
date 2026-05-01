#!/usr/bin/env bun
// Kapy-script CLI — Phase 1
// Supports: check, repl, --version, --help

import { readFileSync } from "fs";
import { Lexer, LexError } from "../lexer";
import { Parser, ParseError, formatParseError } from "../parser";

const VERSION = "0.1.0";

function printHelp(): void {
  console.log(`
kapy v${VERSION} — A programming language designed for AI agent authorship

Usage:
  kapy check <file>    Parse and validate a .kapy file
  kapy repl            Start interactive REPL
  kapy --version       Print version
  kapy --help          Print this help

Commands:
  check     Parse a .kapy file and report any errors
  repl      Start an interactive read-eval-print loop
`);
}

function printVersion(): void {
  console.log(`kapy v${VERSION}`);
}

function runCheck(filePath: string): void {
  let source: string;
  try {
    source = readFileSync(filePath, "utf-8");
  } catch {
    console.error(`Error: Cannot read file '${filePath}'`);
    process.exit(1);
  }

  try {
    const lexer = new Lexer(source, filePath);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens, filePath);
    const ast = parser.parse();

    const declCount = ast.declarations.length;
    console.log(`✓ Parsed successfully (${declCount} declaration${declCount !== 1 ? "s" : ""})`);
  } catch (error) {
    if (error instanceof LexError || error instanceof ParseError) {
      console.error(formatParseError(error as any, source));
      process.exit(1);
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

    // REPL commands
    if (!inBlock && trimmed.startsWith(":")) {
      switch (trimmed) {
        case ":help":
          console.log("  :help     Show this help");
          console.log("  :quit     Exit REPL");
          console.log("  :type <expr>  Show inferred type (not yet implemented)");
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

    // Detect block start (line ends with keyword that expects a block)
    const blockStarters = /\b(fn|agent|tool|if|else|for|while|match|sealed\s+trait|trait|impl|test|parallel|with)\b.*$/;
    if (blockStarters.test(trimmed) && !trimmed.includes("->")) {
      inBlock = true;
      rl.setPrompt(". ");
    } else if (inBlock && trimmed === "") {
      // Empty line in block context — try to parse
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

    if (ast.declarations.length > 0) {
      console.log(`  Defined: ${ast.declarations.map(d => d.kind === "FnDecl" ? d.name : d.kind === "AgentDecl" ? d.name : d.kind).join(", ")}`);
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