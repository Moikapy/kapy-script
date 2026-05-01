// Kapy-script project scaffolding — kapy init <name>

import { mkdirSync, writeFileSync } from "fs";
import { join, resolve } from "path";

export interface InitOptions {
  name: string;
  dir?: string;
}

const GITIGNORE = `.kapy-cache/
node_modules/
*.ts.map
`;

const KAPY_PKG = (name: string) => `name: ${name}
version: 0.1.0
entry: src/main.kapy

dependencies

ai_provider: openai
ai_model: gpt-4
`;

const MAIN_KAPY = (name: string) => `fn main
  print("Hello from ${name}!")
`;

const TEST_KAPY = `test "main works"
  1 + 1 == 2
`;

/** Scaffold a new kapy-script project */
export function initProject(options: InitOptions): void {
  const name = options.name;
  const baseDir = options.dir ? resolve(options.dir, name) : resolve(name);

  // Check if directory already exists
  try {
    mkdirSync(baseDir, { recursive: true });
  } catch (error: any) {
    if (error.code !== "EEXIST") {
      console.error(`Error: Cannot create directory '${baseDir}': ${error.message}`);
      process.exit(1);
    }
  }

  // Create subdirectories
  mkdirSync(join(baseDir, "src"), { recursive: true });
  mkdirSync(join(baseDir, "test"), { recursive: true });
  mkdirSync(join(baseDir, ".kapy-cache"), { recursive: true });

  // Write files
  writeFileSync(join(baseDir, "kapy.pkg"), KAPY_PKG(name), "utf-8");
  writeFileSync(join(baseDir, ".gitignore"), GITIGNORE, "utf-8");
  writeFileSync(join(baseDir, "src", "main.kapy"), MAIN_KAPY(name), "utf-8");
  writeFileSync(join(baseDir, "test", "main.test.kapy"), TEST_KAPY, "utf-8");

  console.log(`✅ Created project '${name}' at ${baseDir}`);
  console.log("");
  console.log("Next steps:");
  console.log(`  cd ${name}`);
  console.log("  kapy run src/main.kapy");
  console.log("  kapy test");
}