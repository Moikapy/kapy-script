/**
 * kapy run — Compile and execute a .kapy file
 *
 * Transpiles .kapy → TypeScript, then runs via Bun.
 * Uses content-hash caching to skip recompilation.
 * Supports --watch flag for file watching.
 */

import type { CommandContext } from "@moikapy/kapy";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, join, dirname } from "path";
import { Lexer, LexError } from "../../lexer/index.js";
import { Parser, ParseError, formatParseError } from "../../parser/index.js";
import { TypeChecker } from "../../typechecker/index.js";
import { formatTypeError } from "../../typechecker/errors.js";
import { Emitter } from "../../transpiler/emitter.js";
import { Cache } from "../../transpiler/cache.js";

/** Full compile pipeline: source → TypeScript */
export function compile(source: string, filePath: string) {
	// Phase 1: Lex
	const tokens = new Lexer(source, filePath).tokenize();

	// Phase 2: Parse
	const ast = new Parser(tokens, filePath).parse();

	// Phase 3: Type Check (non-fatal — warnings, not blockers)
	const checker = new TypeChecker();
	checker.setFile(filePath);
	const typeErrors = checker.check(ast);
	// Type errors are printed but don't block compilation
	// (unlike the CLI check command which exits on errors)

	// Phase 4: Transpile
	const emitter = new Emitter();
	const { code, sourceMap } = emitter.emit(ast);

	return { code, sourceMap, ast, typeErrors };
}

/** Run a .kapy file */
export async function runCommand(ctx: CommandContext): Promise<void> {
	const rest = (ctx.args.rest || []) as string[];
	const filePath = rest[0];
	const watch = ctx.args.watch as boolean;

	if (!filePath) {
		ctx.error("Error: 'run' requires a file path. Usage: kapy run [--watch] <file>");
		ctx.abort(1);
		return;
	}

	if (watch) {
		const { watchAndRun } = await import("../watch.js");
		watchAndRun(filePath, (file: string) => runFile(file, ctx));
	} else {
		runFile(filePath, ctx);
	}
}

/** Run a single file — shared by run and watch */
function runFile(filePath: string, ctx: CommandContext): void {
	const absolutePath = resolve(filePath);
	let source: string;
	try {
		source = readFileSync(absolutePath, "utf-8");
	} catch {
		ctx.error(`Error: Cannot read file '${filePath}'`);
		ctx.abort(1);
		return;
	}

	// Check cache
	const cacheDir = join(dirname(absolutePath), ".kapy-cache");
	const cache = new Cache(cacheDir);
	const cachedPath = cache.getCachedTsPath(absolutePath, source);

	let tsCode: string;
	let tsPath: string;

	if (cachedPath && existsSync(cachedPath)) {
		tsCode = readFileSync(cachedPath, "utf-8");
		tsPath = cachedPath;
	} else {
		try {
			const result = compile(source, absolutePath);
			tsCode = result.code;

			// Print type warnings
			for (const error of result.typeErrors) {
				ctx.warn(formatTypeError(error, source));
			}

			// Cache the output
			const entry = cache.set(absolutePath, source, tsCode);
			tsPath = entry.tsPath;

			// Write source map alongside
			mkdirSync(dirname(tsPath), { recursive: true });
			writeFileSync(tsPath, tsCode, "utf-8");
			writeFileSync(tsPath + ".map", result.sourceMap, "utf-8");
		} catch (error) {
			if (error instanceof LexError || error instanceof ParseError) {
				ctx.error(formatParseError(error as any, source));
			} else {
				ctx.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
			}
			ctx.abort(1);
			return;
		}
	}

	// Ensure the file is written
	mkdirSync(dirname(tsPath), { recursive: true });
	writeFileSync(tsPath, tsCode, "utf-8");

	// Resolve @kapy/runtime: prefer project's node_modules, then bundled
	const runtimePaths = [
		join(resolve("."), "node_modules"),
		join(dirname(absolutePath), "node_modules"),
		resolve(import.meta.dir, "../../"),  // bundled (dev)
	].filter(existsSync);
	const nodePath = runtimePaths.join(":");

	// Execute via Bun
	const result = await ctx.spawn(["bun", "run", tsPath], {
		tty: true,
		env: { NODE_PATH: nodePath },
	});

	if (result.exitCode !== 0) {
		ctx.abort(result.exitCode);
	}
}