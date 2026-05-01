/**
 * kapy test — Discover and run test declarations
 */

import type { CommandContext } from "@moikapy/kapy";
import { readFileSync, existsSync, readdirSync, statSync, mkdirSync, writeFileSync } from "fs";
import { resolve, join, dirname } from "path";
import { Lexer, LexError } from "../../lexer/index.js";
import { Parser, ParseError, formatParseError } from "../../parser/index.js";
import { TypeChecker } from "../../typechecker/index.js";
import { Emitter } from "../../transpiler/emitter.js";

interface TestResult {
	file: string;
	passed: number;
	failed: number;
	errors: string[];
}

export async function testCommand(ctx: CommandContext): Promise<void> {
	const rest = (ctx.args.rest || []) as string[];
	const target = rest[0] ? resolve(rest[0]) : process.cwd();
	const isDir = existsSync(target) && statSync(target).isDirectory();

	let files: string[];
	if (isDir) {
		files = findTestFiles(target);
		if (files.length === 0) {
			ctx.warn("No test files found.");
			console.log("Test files should match: *.test.kapy, test_*.kapy, or *_test.kapy");
			return;
		}
	} else {
		if (!existsSync(target)) {
			ctx.error(`Error: File not found '${target}'`);
			ctx.abort(1);
			return;
		}
		files = [target];
	}

	console.log(`\n🧪 Running ${files.length} test file${files.length !== 1 ? "s" : ""}...\n`);

	const results: TestResult[] = [];
	let totalPassed = 0;
	let totalFailed = 0;

	for (const file of files) {
		const result = runTestFile(file, ctx);
		results.push(result);
		totalPassed += result.passed;
		totalFailed += result.failed;
	}

	console.log("");
	console.log("─".repeat(50));
	if (totalFailed === 0) {
		ctx.log(`All ${totalPassed} test${totalPassed !== 1 ? "s" : ""} passed!`);
	} else {
		ctx.error(`${totalFailed} test${totalFailed !== 1 ? "s" : ""} failed, ${totalPassed} passed`);
		ctx.abort(1);
	}
}

function findTestFiles(dir: string): string[] {
	const files: string[] = [];

	function walk(d: string): void {
		const entries = readdirSync(d, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === ".kapy-cache") continue;

			const fullPath = join(d, entry.name);
			if (entry.isDirectory()) {
				walk(fullPath);
			} else if (entry.name.endsWith(".kapy")) {
				files.push(fullPath);
			}
		}
	}

	walk(dir);
	return files;
}

function runTestFile(filePath: string, ctx: CommandContext): TestResult {
	const errors: string[] = [];
	console.log(`  📄 ${filePath}`);

	let source: string;
	try {
		source = readFileSync(filePath, "utf-8");
	} catch (error: any) {
		console.log(`    ❌ Cannot read file: ${error.message}`);
		return { file: filePath, passed: 0, failed: 1, errors: [error.message] };
	}

	// Check if file has test declarations
	if (!source.includes("test ")) {
		console.log(`    ⏭️  No test declarations found, skipping`);
		return { file: filePath, passed: 0, failed: 0, errors: [] };
	}

	// Compile
	let ast: any;
	try {
		const tokens = new Lexer(source, filePath).tokenize();
		ast = new Parser(tokens, filePath).parse();
	} catch (error: any) {
		if (error instanceof LexError || error instanceof ParseError) {
			const msg = formatParseError(error as any, source);
			console.log(`    ❌ Parse error:\n${msg}`);
			errors.push(msg);
		} else {
			console.log(`    ❌ Error: ${error.message}`);
			errors.push(error.message);
		}
		return { file: filePath, passed: 0, failed: 1, errors };
	}

	// Type check (non-blocking)
	const checker = new TypeChecker();
	checker.setFile(filePath);
	const typeErrors = checker.check(ast);
	for (const error of typeErrors) {
		const msg = `Type error at ${error.span.start.line}:${error.span.start.column} — ${error.message}`;
		console.log(`    ⚠️  ${msg}`);
		errors.push(msg);
	}

	// Count tests
	const testCount = ast.declarations.filter((d: any) => d.kind === "TestDecl").length;
	if (testCount === 0) {
		console.log(`    ⏭️  No test declarations found, skipping`);
		return { file: filePath, passed: 0, failed: 0, errors: [] };
	}

	// Transpile
	const emitter = new Emitter();
	const { code } = emitter.emit(ast);

	// Write and run via bun test
	const cacheDir = join(dirname(filePath), ".kapy-cache");
	mkdirSync(cacheDir, { recursive: true });
	const baseName = filePath.replace(/\//g, "_").replace(/\.kapy$/, "");
	const tsPath = join(cacheDir, `${baseName}.test.ts`);
	writeFileSync(tsPath, code, "utf-8");

	// Resolve runtime
	const runtimePaths = [
		join(resolve("."), "node_modules"),
		resolve(import.meta.dir, "../../"),
	].filter(existsSync);
	const nodePath = runtimePaths.join(":");

	// Use relative path for bun test (it needs ./ prefix)
	const relTsPath = tsPath.startsWith(resolve(".")) ? "./" + tsPath.slice(resolve(".").length + 1) : tsPath;

	const result = ctx.spawn(["bun", "test", relTsPath], {
		env: { NODE_PATH: nodePath },
	});

	// Parse bun test output
	const output = (result.stdout || "") + (result.stderr || "");
	const passMatch = output.match(/(\d+) pass/);
	const failMatch = output.match(/(\d+) fail/);
	const passed = passMatch ? parseInt(passMatch[1]) : 0;
	const failed = failMatch ? parseInt(failMatch[1]) : 0;

	if (result.exitCode !== 0 && failed === 0) {
		console.log(`    ❌ Test runner error:`);
		console.log(output);
		return { file: filePath, passed: 0, failed: testCount, errors: [output] };
	}

	if (failed > 0) {
		console.log(`    ❌ ${failed} failed, ${passed} passed`);
		console.log(output);
	} else {
		console.log(`    ✅ ${passed} test${passed !== 1 ? "s" : ""} passed`);
	}

	return { file: filePath, passed, failed, errors };
}