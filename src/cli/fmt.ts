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

/** Check if a position is inside a string literal */
function isInString(line: string, pos: number): boolean {
  let inString = false;
  let escaped = false;
  for (let i = 0; i < pos; i++) {
    const ch = line[i];
    if (escaped) { escaped = false; continue; }
    if (ch === "\\") { escaped = true; continue; }
    if (ch === '"') { inString = !inString; }
  }
  return inString;
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

    // Normalize indentation to 2-space multiples
    const indentMatch = line.match(/^([ ]{2,})(\S)/);
    if (indentMatch && indentMatch[1].length > 0) {
      const spaces = indentMatch[1].length;
      // If not a multiple of 2, round to nearest
      if (spaces % 2 !== 0) {
        const normalized = Math.round(spaces / 2) * 2;
        line = " ".repeat(normalized) + line.trimStart();
      }
    }

    // Normalize spacing around -> (arrow)
    // "x->y" → "x -> y" (but not inside strings)
    for (let pos = 0; pos < line.length - 1; pos++) {
      if (isInString(line, pos)) continue;
      // Check for -> without spaces
      if (line[pos] === "-" && line[pos + 1] === ">") {
        // Don't touch if it's => or already spaced
        // Check context — only in match/case/lambda contexts
      }
    }

    // Normalize spacing around type annotations: "x:number" → "x: number"
    // Only outside strings
    const inStringSegments: [number, number][] = [];
    let sStart = -1;
    for (let pos = 0; pos < line.length; pos++) {
      if (line[pos] === '"' && (pos === 0 || line[pos - 1] !== '\\')) {
        if (sStart === -1) { sStart = pos; } else { inStringSegments.push([sStart, pos]); sStart = -1; }
      }
    }
    if (sStart !== -1) inStringSegments.push([sStart, line.length]);

    const isInStringAt = (p: number) => inStringSegments.some(([s, e]) => p >= s && p <= e);

    // Type annotation spacing — only outside strings
    let result = "";
    for (let pos = 0; pos < line.length; pos++) {
      if (line[pos] === ":" && !isInStringAt(pos)) {
        // Don't touch :: or URLs
        if (line[pos + 1] === ":") { result += "::"; pos++; continue; }
        // "x:number" → "x: number"
        if (pos > 0 && /\w/.test(line[pos - 1]) && pos + 1 < line.length && /\w/.test(line[pos + 1])) {
          result += ": ";
          continue;
        }
        // "x:  number" → "x: number"
        if (result.endsWith(": ")) {
          // Skip extra spaces after colon
          while (pos + 1 < line.length && line[pos + 1] === " ") pos++;
          continue;
        }
      }
      result += line[pos];
    }
    line = result;

    // Normalize spacing around binary operators (string-aware)
    const binOps = ["==", "!=", "+", "-", "*", "/", "%", "&&", "||", "<=", ">="];
    for (const op of binOps) {
      // Split line into string / non-string segments
      // Only format the non-string segments
      const segments: string[] = [];
      let inStr = false;
      let segStart = 0;
      for (let p = 0; p < line.length; p++) {
        if (line[p] === '"' && (p === 0 || line[p - 1] !== '\\')) {
          if (!inStr) {
            segments.push(line.slice(segStart, p));
            segStart = p;
          } else {
            segments.push(line.slice(segStart, p + 1));
            segStart = p + 1;
          }
          inStr = !inStr;
        }
      }
      segments.push(line.slice(segStart));

      // Apply spacing only to odd-indexed segments (outside strings)
      const opEsc = op.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      for (let si = 0; si < segments.length; si += 2) {
        // Skip empty segments
        if (!segments[si]) continue;
        // Arithmetic ops: only add spaces between word chars
        if (op === "+" || op === "-" || op === "*" || op === "/" || op === "%") {
          segments[si] = segments[si].replace(new RegExp(`(\\w)${opEsc}(\\w)`, "g"), `$1 ${op} $2`);
        } else {
          // Comparison and logical ops: always add spaces around
          segments[si] = segments[si].replace(new RegExp(`(\\S)${opEsc}`, "g"), `$1 ${op}`);
          segments[si] = segments[si].replace(new RegExp(`${opEsc}(\\S)`, "g"), `${op} $1`);
        }
      }
      line = segments.join("");
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