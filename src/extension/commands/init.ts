/**
 * kapy init — Scaffold a new kapy-script project
 */

import type { CommandContext } from "@moikapy/kapy";
import { mkdirSync, writeFileSync } from "fs";
import { join, resolve } from "path";

const GITIGNORE = `.kapy-cache/
node_modules/
*.ts.map
dist/
`;

const KAPY_PKG = (name: string) => `name: ${name}
version: 0.1.0
entry: src/main.kapy

dependencies
  @kapy/runtime: ^0.1.0

ai_provider: openai
ai_model: gpt-4
`;

const PACKAGE_JSON = (name: string) => `{
  "name": "${name}",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "start": "kapy run src/main.kapy",
    "test": "kapy test",
    "check": "kapy check src/main.kapy"
  },
  "dependencies": {
    "@kapy/runtime": "^0.1.0"
  }
}
`;

const MAIN_KAPY = (name: string) => `fn main
  print("Hello from ${name}!")
`;

const TEST_KAPY = `test "greeting works"
  print("test: greeting")
`;

const README = (name: string) => `# ${name}

A kapy-script project.

## Getting Started

\`\`\`bash
bun install    # Install @kapy/runtime
kapy run src/main.kapy
kapy test
\`\`\`
`;

export async function initCommand(ctx: CommandContext): Promise<void> {
	const rest = (ctx.args.rest || []) as string[];
	const name = rest[0];

	if (!name) {
		ctx.error("Error: 'init' requires a project name. Usage: kapy init <name>");
		ctx.abort(1);
		return;
	}

	const baseDir = resolve(name);

	mkdirSync(join(baseDir, "src"), { recursive: true });
	mkdirSync(join(baseDir, "test"), { recursive: true });
	mkdirSync(join(baseDir, ".kapy-cache"), { recursive: true });

	writeFileSync(join(baseDir, "kapy.pkg"), KAPY_PKG(name), "utf-8");
	writeFileSync(join(baseDir, "package.json"), PACKAGE_JSON(name), "utf-8");
	writeFileSync(join(baseDir, ".gitignore"), GITIGNORE, "utf-8");
	writeFileSync(join(baseDir, "README.md"), README(name), "utf-8");
	writeFileSync(join(baseDir, "src", "main.kapy"), MAIN_KAPY(name), "utf-8");
	writeFileSync(join(baseDir, "test", "main.test.kapy"), TEST_KAPY, "utf-8");

	ctx.log(`✅ Created project '${name}' at ${baseDir}`);
	console.log("");
	console.log("Next steps:");
	console.log(`  cd ${name}`);
	console.log("  bun install    # Install @kapy/runtime");
	console.log("  kapy run src/main.kapy");
}