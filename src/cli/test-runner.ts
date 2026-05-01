// Kapy-script test runner — discovers and runs test declarations

import { readFileSync, existsSync, readdirSync, statSync, mkdirSync, writeFileSync } from "fs";
import { resolve, join, dirname } from "path";
import { Lexer, LexError } from "../lexer";
import { Parser, ParseError, formatParseError } from "../parser";
import type { KapyError } from "../parser/errors";
import { TypeChecker } from "../typechecker";
import { Emitter } from "../transpiler/emitter";

interface TestResult {
  file: string;
  passed: number;
  failed: number;
  errors: string[];
  duration: number;
}

/** Run tests in a file or directory */
export function runTests(path?: string): void {
  const target = path ? resolve(path) : process.cwd();
  const isDir = existsSync(target) && statSync(target).isDirectory();

  let files: string[];

  if (isDir) {
    files = findTestFiles(target);
    if (files.length === 0) {
      console.log("No test files found.");
      console.log("");
      console.log("Test files should match: *.test.kapy, test_*.kapy, or *_test.kapy");
      return;
    }
  } else {
    if (!existsSync(target)) {
      console.error(`Error: File not found '${target}'`);
      process.exit(1);
    }
    files = [target];
  }

  console.log(`\n🧪 Running ${files.length} test file${files.length !== 1 ? "s" : ""}...\n`);

  const results: TestResult[] = [];
  let totalPassed = 0;
  let totalFailed = 0;

  for (const file of files) {
    const result = runTestFile(file);
    results.push(result);
    totalPassed += result.passed;
    totalFailed += result.failed;
  }

  // Print summary
  console.log("");
  console.log("─".repeat(50));
  if (totalFailed === 0) {
    console.log(`✅ All ${totalPassed} test${totalPassed !== 1 ? "s" : ""} passed!`);
  } else {
    console.log(`❌ ${totalFailed} test${totalFailed !== 1 ? "s" : ""} failed, ${totalPassed} passed`);
    process.exit(1);
  }
}

function findTestFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(d: string): void {
    const entries = readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      // Skip hidden directories and node_modules
      if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === ".kapy-cache") continue;

      const fullPath = join(d, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith(".kapy")) {
        // Test files match: *.test.kapy, test_*.kapy, *_test.kapy, or any .kapy with test declarations
        if (
          entry.name.includes(".test.") ||
          entry.name.startsWith("test_") ||
          entry.name.endsWith("_test.kapy") ||
          // Also include if the file contains test declarations (checked later)
          true
        ) {
          files.push(fullPath);
        }
      }
    }
  }

  walk(dir);
  return files;
}

function runTestFile(filePath: string): TestResult {
  const start = Date.now();
  const errors: string[] = [];

  console.log(`  📄 ${filePath}`);

  let source: string;
  try {
    source = readFileSync(filePath, "utf-8");
  } catch (error: any) {
    console.log(`    ❌ Cannot read file: ${error.message}`);
    return { file: filePath, passed: 0, failed: 1, errors: [error.message], duration: Date.now() - start };
  }

  // Check if file has any test declarations
  if (!source.includes("test ")) {
    console.log(`    ⏭️  No test declarations found, skipping`);
    return { file: filePath, passed: 0, failed: 0, errors: [], duration: Date.now() - start };
  }

  // Compile pipeline
  let ast: import("../parser/ast").Program;
  try {
    const tokens = new Lexer(source, filePath).tokenize();
    ast = new Parser(tokens, filePath).parse();
  } catch (error: any) {
    if (error instanceof LexError || error instanceof ParseError) {
      const msg = formatParseError(error as KapyError, source);
      console.log(`    ❌ Parse error:\n${msg}`);
      errors.push(msg);
    } else {
      console.log(`    ❌ Error: ${error.message}`);
      errors.push(error.message);
    }
    return { file: filePath, passed: 0, failed: 1, errors, duration: Date.now() - start };
  }

  // Type check
  const checker = new TypeChecker();
  checker.setFile(filePath);
  const typeErrors = checker.check(ast);
  if (typeErrors.length > 0) {
    for (const error of typeErrors) {
      const msg = `Type error at ${error.line}:${error.column} — ${error.message}`;
      console.log(`    ⚠️  ${msg}`);
      errors.push(msg);
    }
    // Still proceed — type warnings don't block test execution
  }

  // Count test declarations
  const testCount = ast.declarations.filter(d => d.kind === "TestDecl").length;
  if (testCount === 0) {
    console.log(`    ⏭️  No test declarations found, skipping`);
    return { file: filePath, passed: 0, failed: 0, errors: [], duration: Date.now() - start };
  }

  // Transpile
  const emitter = new Emitter();
  const { code } = emitter.emit(ast);

  // Add bun:test import if not present
  const testCode = code.includes('test("') ? code : code;

  // Write to cache and run via bun test
  const cacheDir = join(dirname(filePath), ".kapy-cache");
  mkdirSync(cacheDir, { recursive: true });
  const baseName = filePath.replace(/\//g, "_").replace(/\.kapy$/, "");
  const tsPath = join(cacheDir, `${baseName}.test.ts`);
  writeFileSync(tsPath, testCode, "utf-8");

  try {
    // bun test needs relative path from cwd
    const cwd = process.cwd();
    const relTsPath = tsPath.startsWith(cwd) ? "./" + tsPath.slice(cwd.length + 1) : "./" + tsPath;
    const proc = Bun.spawnSync(["bun", "test", relTsPath], {
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        NODE_PATH: [
          join(resolve("."), "node_modules"),
          resolve(__dirname, ".."),
        ].join(":"),
      },
    });

    const stdout = (proc.stdout?.toString() || "") + (proc.stderr?.toString() || "");

    // Parse bun test output for results
    const passMatch = stdout.match(/(\d+) pass/);
    const failMatch = stdout.match(/(\d+) fail/);

    const passed = passMatch ? parseInt(passMatch[1]) : 0;
    const failed = failMatch ? parseInt(failMatch[1]) : 0;

    if (proc.exitCode !== 0 && failed === 0) {
      // Test runner itself failed
      console.log(`    ❌ Test runner error:`);
      console.log(stdout);
      return { file: filePath, passed: 0, failed: testCount, errors: [stdout], duration: Date.now() - start };
    }

    if (failed > 0) {
      console.log(`    ❌ ${failed} failed, ${passed} passed`);
      console.log(stdout);
    } else {
      console.log(`    ✅ ${passed} test${passed !== 1 ? "s" : ""} passed`);
    }

    return { file: filePath, passed, failed, errors, duration: Date.now() - start };
  } catch (error: any) {
    console.log(`    ❌ Failed to run tests: ${error.message}`);
    return { file: filePath, passed: 0, failed: testCount, errors: [error.message], duration: Date.now() - start };
  }
}