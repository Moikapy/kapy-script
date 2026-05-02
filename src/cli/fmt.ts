// Kapy-script Code Formatter — kapy fmt
// Opinionated formatter for .kapy source files

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { Lexer } from "../lexer/lexer";
import { Parser } from "../parser/parser";

export interface FormatOptions {
  /** Check formatting without writing (exit 1 if changes needed) */
  check: boolean;
  /** Write formatted output to stdout instead of file */
  dryRun: boolean;
}

export interface FormatResult {
  /** Whether the file needed formatting changes */
  changed: boolean;
  /** The formatted output */
  formatted: string;
}

/** Format a kapy-script source string */
export function formatSource(source: string): string {
  // 1. Validate syntax by parsing
  // If parsing fails, return original source unchanged
  try {
    const tokens = new Lexer(source, "<fmt>").tokenize();
    new Parser(tokens, "<fmt>").parse();
  } catch {
    // Parse errors — return original so user can fix syntax first
    return source;
  }

  const lines = source.split("\n");
  const formatted: string[] = [];

  // 2. Format line by line
  let prevWasBlank = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Remove trailing whitespace
    line = line.replace(/\s+$/, "");

    // Normalize multiple blank lines to single
    if (line === "") {
      if (prevWasBlank) continue;
      prevWasBlank = true;
      formatted.push(line);
      continue;
    }

    prevWasBlank = false;

    // Normalize spacing around type annotations: "x:number" → "x: number"
    line = line.replace(/(\w):(\w)/g, "$1: $2");
    // But not for :: (module paths) or URLs
    line = line.replace(/: :\s/g, ":: ");
    // Fix over-spacing: "x:  number" → "x: number"
    line = line.replace(/:\s{2,}/g, ": ");

    // Normalize spacing around operators
    // "x+1" → "x + 1" (but not inside strings or interpolation)
    if (!line.includes('"')) {
      line = line.replace(/(\w)\+/g, "$1 +");
      line = line.replace(/\+(\w)/g, "+ $1");
      line = line.replace(/(\w)==/g, "$1 ==");
      line = line.replace(/==(\w)/g, "== $1");
      line = line.replace(/(\w)!=/g, "$1 !=");
      line = line.replace(/!=(\w)/g, "!= $1");
    }

    formatted.push(line);
  }

  // 3. Ensure final newline
  let result = formatted.join("\n");
  if (!result.endsWith("\n")) {
    result += "\n";
  }

  // 4. Remove trailing blank lines at end of file (keep exactly one final newline)
  result = result.replace(/\n{3,}$/, "\n");

  return result;
}

/** Format a single file, optionally writing back */
export function formatFile(filePath: string, options: FormatOptions): FormatResult {
  const absolutePath = resolve(filePath);
  let source: string;
  try {
    source = readFileSync(absolutePath, "utf-8");
  } catch {
    console.error(`Error: Cannot read file '${filePath}'`);
    process.exit(1);
  }

  const formatted = formatSource(source);
  const changed = formatted !== source;

  if (options.dryRun) {
    console.log(formatted);
    return { changed, formatted };
  }

  if (options.check) {
    if (changed) {
      console.error(`Error: '${filePath}' needs formatting`);
      return { changed, formatted };
    }
    return { changed, formatted };
  }

  // Write back
  if (changed) {
    writeFileSync(absolutePath, formatted, "utf-8");
    console.log(`Formatted ${filePath}`);
  } else {
    console.log(`${filePath} already formatted`);
  }

  return { changed, formatted };
}

/** Format multiple files, returning the count of changed files */
export function formatFiles(files: string[], options: FormatOptions): number {
  let changedCount = 0;
  for (const file of files) {
    const result = formatFile(file, options);
    if (result.changed) changedCount++;
  }
  return changedCount;
}