/**
 * kapy check — Parse and type-check a .kapy file
 */

import type { CommandContext } from "@moikapy/kapy";
import { readFileSync } from "fs";
import { resolve } from "path";
import { Lexer, LexError } from "../../lexer/index.js";
import { Parser, ParseError, formatParseError } from "../../parser/index.js";
import { TypeChecker } from "../../typechecker/index.js";
import { formatTypeError } from "../../typechecker/errors.js";

export async function checkCommand(ctx: CommandContext): Promise<void> {
	const rest = (ctx.args.rest || []) as string[];
	const filePath = rest[0];

	if (!filePath) {
		ctx.error("Error: 'check' requires a file path. Usage: kapy check <file>");
		ctx.abort(1);
		return;
	}

	const absolutePath = resolve(filePath);
	let source: string;
	try {
		source = readFileSync(absolutePath, "utf-8");
	} catch {
		ctx.error(`Error: Cannot read file '${filePath}'`);
		ctx.abort(1);
		return;
	}

	try {
		// Phase 1: Lex
		const tokens = new Lexer(source, absolutePath).tokenize();

		// Phase 2: Parse
		const ast = new Parser(tokens, absolutePath).parse();

		// Phase 3: Type Check
		const checker = new TypeChecker();
		checker.setFile(absolutePath);
		const typeErrors = checker.check(ast);

		if (typeErrors.length > 0) {
			for (const error of typeErrors) {
				ctx.error(formatTypeError(error, source));
			}
			ctx.abort(1);
			return;
		}

		const declCount = ast.declarations.length;
		ctx.log(`✓ Type-checked successfully (${declCount} declaration${declCount !== 1 ? "s" : ""}, 0 errors)`);
	} catch (error) {
		if (error instanceof LexError || error instanceof ParseError) {
			ctx.error(formatParseError(error as any, source));
		} else {
			ctx.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
		}
		ctx.abort(1);
	}
}