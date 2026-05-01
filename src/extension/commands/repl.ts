/**
 * kapy repl — Interactive read-eval-print loop
 */

import type { CommandContext } from "@moikapy/kapy";
import { readFileSync } from "fs";
import { resolve } from "path";
import { Lexer, LexError } from "../../lexer/index.js";
import { Parser, ParseError } from "../../parser/index.js";
import { TypeChecker } from "../../typechecker/index.js";
import * as readline from "node:readline";

const VERSION = "0.1.0";

export async function replCommand(_ctx: CommandContext): Promise<void> {
	console.log(`kapy-script v${VERSION} — Type :help for commands`);
	console.log("");

	let declarations = "";
	let buffer = "";
	let inBlock = false;

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
		prompt: "> ",
	});

	rl.prompt();

	rl.on("line", (line: string) => {
		const trimmed = line.trim();

		// Handle REPL commands
		if (!inBlock && trimmed.startsWith(":")) {
			const command = trimmed.split(/\s+/)[0];
			const arg = trimmed.slice(command.length).trim();

			switch (command) {
				case ":help":
					console.log("");
					console.log("  Commands:");
					console.log("    :help        Show this help");
					console.log("    :quit        Exit REPL");
					console.log("    :type <expr> Show inferred type");
					console.log("    :load <file> Load a .kapy file");
					console.log("    :reset       Clear session");
					console.log("    :list        Show declarations");
					console.log("");
					break;
				case ":quit":
				case ":exit":
					rl.close();
					return;
				case ":reset":
					declarations = "";
					buffer = "";
					inBlock = false;
					console.log("  ✅ Session reset");
					break;
				case ":list":
					if (declarations) {
						console.log("  Current declarations:");
						console.log(declarations.split("\n").map(l => "    " + l).join("\n"));
					} else {
						console.log("  No declarations in session");
					}
					break;
				case ":type":
					showType(arg);
					break;
				case ":load":
					loadFile(arg);
					break;
				default:
					console.log(`  Unknown command: ${command}. Type :help for available commands.`);
			}
			rl.prompt();
			return;
		}

		// Accumulate multi-line input
		buffer += (buffer ? "\n" : "") + line;

		const blockStarters = /\b(fn|agent|tool|sealed\s+trait|trait|impl|test|parallel|with)\b/;
		if (!inBlock && blockStarters.test(trimmed)) {
			if (!trimmed.includes("->") || trimmed.startsWith("fn") || trimmed.startsWith("agent") || trimmed.startsWith("sealed") || trimmed.startsWith("trait") || trimmed.startsWith("test")) {
				inBlock = true;
				rl.setPrompt(". ");
			}
		}

		if (inBlock && trimmed === "") {
			inBlock = false;
			rl.setPrompt("> ");
		}

		if (!inBlock && buffer.trim()) {
			tryEval(buffer);
			declarations += (declarations ? "\n\n" : "") + buffer;
			buffer = "";
		}

		rl.prompt();
	});

	rl.on("close", () => {
		console.log("\nBye! 🐉");
		process.exit(0);
	});

	function tryEval(source: string): void {
		try {
			const tokens = new Lexer(source, "<repl>").tokenize();
			const ast = new Parser(tokens, "<repl>").parse();
			const checker = new TypeChecker();
			const typeErrors = checker.check(ast);

			if (ast.declarations.length > 0) {
				const names = ast.declarations.map((d: any) => {
					switch (d.kind) {
						case "FnDecl": return `fn ${d.name}`;
						case "AgentDecl": return `agent ${d.name}`;
						case "ToolDecl": return `tool ${d.name}`;
						case "SealedTraitDecl": return `sealed trait ${d.name}`;
						case "TraitDecl": return `trait ${d.name}`;
						case "ImplDecl": return `impl ${d.trait_name} for ${d.for_name}`;
						case "TestDecl": return `test "${d.name}"`;
						case "ImportDecl": return `import ${d.module.join("/")}`;
						default: return d.kind;
					}
				});
				console.log(`  Defined: ${names.join(", ")}`);
				if (typeErrors.length > 0) {
					console.log(`  ⚠ ${typeErrors.length} type warning(s)`);
				}
			}
		} catch (error: any) {
			if (error instanceof LexError || error instanceof ParseError) {
				console.error(`  ${error.message}`);
			} else {
				console.error(`  Error: ${error.message || error}`);
			}
		}
	}

	function showType(expr: string): void {
		if (!expr) {
			console.log("  Usage: :type <expression>");
			return;
		}
		try {
			const source = `fn __type_probe\n  output any\n  ${expr}`;
			const tokens = new Lexer(source, "<repl>").tokenize();
			const ast = new Parser(tokens, "<repl>").parse();
			const checker = new TypeChecker();
			checker.check(ast);

			if (ast.declarations.length > 0 && ast.declarations[0].kind === "FnDecl") {
				const fn = ast.declarations[0];
				if (fn.output_type) {
					console.log(`  Type: ${formatType(fn.output_type)}`);
				} else {
					console.log("  Type: any (inferred)");
				}
			}
		} catch (error: any) {
			console.error(`  ${error.message || error}`);
		}
	}

	function formatType(t: any): string {
		if (!t) return "void";
		switch (t.kind) {
			case "PrimitiveType": return t.name;
			case "NamedType": return t.name;
			case "ArrayType": return `${formatType(t.element_type)}[]`;
			case "GenericType": return `${t.name}<${t.type_args.map(formatType).join(", ")}>`;
			case "FunctionType": return `(${t.params.map(formatType).join(", ")}) => ${formatType(t.return_type)}`;
			default: return "any";
		}
	}

	function loadFile(filePath: string): void {
		if (!filePath) {
			console.log("  Usage: :load <file.kapy>");
			return;
		}
		const absolutePath = resolve(filePath);
		try {
			const source = readFileSync(absolutePath, "utf-8");
			tryEval(source);
			declarations += (declarations ? "\n\n" : "") + source;
			console.log(`  ✅ Loaded ${filePath}`);
		} catch (error: any) {
			console.error(`  ❌ Cannot load file: ${error.message}`);
		}
	}
}