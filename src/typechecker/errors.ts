// Kapy-script Type Check Errors

import { type KapyError } from "../parser/errors";

export class TypeCheckError extends Error implements KapyError {
  constructor(
    public readonly file: string,
    public readonly line: number,
    public readonly column: number,
    public readonly message: string,
  ) {
    super(`Type Error in ${file}:${line}:${column}: ${message}`);
    this.name = "TypeCheckError";
  }
}

/** Format a type check error with source context */
export function formatTypeError(error: TypeCheckError, source: string): string {
  const lines = source.split("\n");
  const lineNum = error.line;
  const colNum = error.column;

  let output = `\n  Type Error: ${error.message}\n`;
  output += `  → ${error.file}:${lineNum}:${colNum}\n`;

  if (lineNum >= 1 && lineNum <= lines.length) {
    const line = lines[lineNum - 1];
    output += `   |\n`;
    output += `${String(lineNum).padStart(3)} | ${line}\n`;
    output += `   | ${" ".repeat(Math.max(0, colNum - 1))}^\n`;
  }

  return output;
}

/** Type check result */
export interface TypeCheckResult {
  errors: TypeCheckError[];
  success: boolean;
}